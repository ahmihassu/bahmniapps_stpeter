'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('cervicalMap', ['$timeout', '$window', function ($timeout, $window) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                patient: '=',
                fixed: '=?'
            },
            link: function (scope, element) {
                scope.tools = [
                    {value: 'eraser', label: 'Eraser'},
                    {value: 'scj', label: 'SCJ'},
                    {value: 'epithelium', label: 'White epithelium'},
                    {value: 'os', label: 'OS'},
                    {value: 'cancer', label: 'Ca on'}
                ];
                scope.brushSizes = [2, 4, 8, 12];
                scope.selectedTool = null;
                scope.selectedBrushSize = 2;
                scope.drawing = {
                    version: 2,
                    strokes: [],
                    markers: []
                };
                scope.history = [];
                scope.surfaceHeight = 540;
                scope.viewBox = {
                    width: 760,
                    height: 540
                };
                scope.templateCircle = {
                    cx: 240,
                    cy: 245,
                    r: 130
                };

                var surfaceEl = element[0].querySelector('.cervical-map-surface');
                var canvas = element[0].querySelector('.cervical-map-canvas');
                var ctx = canvas.getContext('2d');
                var currentStroke = null;
                var isDrawing = false;

                var toolConfig = {
                    pen: {color: '#1f2937', lineWidth: 2, composite: 'source-over'},
                    eraser: {color: 'rgba(0,0,0,1)', lineWidth: 16, composite: 'destination-out'},
                    scj: {color: '#111111', lineWidth: 2, composite: 'source-over'},
                    epithelium: {color: 'rgba(120, 120, 120, 0.35)', lineWidth: 14, composite: 'source-over'}
                };
                var toolDefaultSizes = {
                    scj: 2,
                    epithelium: 8,
                    eraser: 12,
                    cancer: 12
                };

                var cloneDrawing = function (drawing) {
                    return angular.copy(drawing);
                };

                var getBrushSize = function (tool) {
                    if (tool === 'eraser' || tool === 'scj' || tool === 'epithelium' || tool === 'cancer') {
                        return Number(scope.selectedBrushSize) || 4;
                    }
                    return toolConfig[tool].lineWidth;
                };

                var normalizePoint = function (point) {
                    return {
                        x: Math.round(point.x * 100) / 100,
                        y: Math.round(point.y * 100) / 100
                    };
                };

                var migrateLegacyMarker = function (item) {
                    if (!item || item.display === false) return null;
                    if (item.type === 'acetowhite') {
                        return {
                            tool: 'epithelium',
                            size: toolConfig.epithelium.lineWidth,
                            color: toolConfig.epithelium.color,
                            composite: toolConfig.epithelium.composite,
                            points: [normalizePoint(item)]
                        };
                    }
                    if (item.type === 'atypical_vessels') {
                        return {
                            tool: 'pen',
                            size: 4,
                            color: '#8b0000',
                            composite: 'source-over',
                            points: [normalizePoint(item)]
                        };
                    }
                    return {
                        tool: 'os',
                        x: Math.round(item.x),
                        y: Math.round(item.y)
                    };
                };

                var parseSavedValue = function () {
                    if (!scope.observation.value) {
                        return cloneDrawing(scope.drawing);
                    }
                    try {
                        var parsed = JSON.parse(scope.observation.value);
                        if (_.isArray(parsed)) {
                            var migrated = {
                                version: 2,
                                strokes: [],
                                markers: []
                            };
                            _.each(parsed, function (item) {
                                var legacyItem = migrateLegacyMarker(item);
                                if (!legacyItem) return;
                                if (legacyItem.tool === 'os') {
                                    migrated.markers.push(legacyItem);
                                } else {
                                    migrated.strokes.push(legacyItem);
                                }
                            });
                            return migrated;
                        }
                        if (parsed && parsed.version === 2) {
                            return {
                                version: 2,
                                strokes: _.isArray(parsed.strokes) ? parsed.strokes : [],
                                markers: _.isArray(parsed.markers) ? parsed.markers : []
                            };
                        }
                        if (_.isArray(parsed)) {
                            return cloneDrawing(scope.drawing);
                        }
                    } catch (e) {
                        return cloneDrawing(scope.drawing);
                    }
                    return cloneDrawing(scope.drawing);
                };

                var beginPathAt = function (point) {
                    ctx.beginPath();
                    ctx.moveTo(point.x, point.y);
                };

                var getScale = function () {
                    return {
                        x: canvas.width / scope.viewBox.width,
                        y: canvas.height / scope.viewBox.height
                    };
                };

                var getDrawingCircle = function () {
                    var scale = getScale();
                    return {
                        cx: scope.templateCircle.cx * scale.x,
                        cy: scope.templateCircle.cy * scale.y,
                        r: scope.templateCircle.r * Math.min(scale.x, scale.y)
                    };
                };

                var pointInsideCircle = function (point) {
                    var circle = getDrawingCircle();
                    var dx = point.x - circle.cx;
                    var dy = point.y - circle.cy;
                    return ((dx * dx) + (dy * dy)) <= (circle.r * circle.r);
                };

                var applyDrawingClip = function () {
                    var circle = getDrawingCircle();
                    ctx.beginPath();
                    ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
                    ctx.clip();
                };

                var drawStroke = function (stroke) {
                    if (!stroke || !_.isArray(stroke.points) || !stroke.points.length) return;
                    var points = stroke.points;
                    var firstPoint = points[0];
                    ctx.save();
                    applyDrawingClip();
                    ctx.globalCompositeOperation = stroke.composite || 'source-over';
                    ctx.strokeStyle = stroke.color || toolConfig.pen.color;
                    ctx.lineWidth = stroke.size || 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    if (points.length === 1) {
                        ctx.beginPath();
                        ctx.arc(firstPoint.x, firstPoint.y, (stroke.size || 2) / 2, 0, Math.PI * 2);
                        if (stroke.composite === 'destination-out') {
                            ctx.fill();
                        } else {
                            ctx.fillStyle = stroke.color || toolConfig.pen.color;
                            ctx.fill();
                        }
                    } else {
                        beginPathAt(firstPoint);
                        _.each(points.slice(1), function (point) {
                            ctx.lineTo(point.x, point.y);
                        });
                        ctx.stroke();
                        if (stroke.tool === 'epithelium' && stroke.composite !== 'destination-out') {
                            var step = Math.max(4, (stroke.size || 8) * 0.9);
                            _.each(points, function (point, index) {
                                if (index % 2 !== 0) return;
                                ctx.beginPath();
                                ctx.fillStyle = 'rgba(90, 90, 90, 0.55)';
                                ctx.arc(point.x, point.y, Math.max(1.2, (stroke.size || 8) * 0.12), 0, Math.PI * 2);
                                ctx.fill();
                                if (index + 1 < points.length) {
                                    var nextPoint = points[index + 1];
                                    var dx = nextPoint.x - point.x;
                                    var dy = nextPoint.y - point.y;
                                    var distance = Math.sqrt((dx * dx) + (dy * dy));
                                    if (distance > step) {
                                        var midX = point.x + (dx / 2);
                                        var midY = point.y + (dy / 2);
                                        ctx.beginPath();
                                        ctx.arc(midX, midY, Math.max(1.2, (stroke.size || 8) * 0.12), 0, Math.PI * 2);
                                        ctx.fill();
                                    }
                                }
                            });
                        }
                    }
                    ctx.restore();
                };

                var drawScjShape = function (x, y) {
                    var radius = 34;
                    var segments = 24;
                    ctx.beginPath();
                    _.times(segments + 1, function (idx) {
                        var angle = (idx / segments) * Math.PI * 2;
                        var wobble = 1 + 0.11 * Math.sin(angle * 6);
                        var px = x + (radius * wobble * Math.cos(angle));
                        var py = y + (radius * wobble * Math.sin(angle));
                        if (idx === 0) {
                            ctx.moveTo(px, py);
                        } else {
                            ctx.lineTo(px, py);
                        }
                    });
                    ctx.closePath();
                };

                var drawEpitheliumShape = function (x, y) {
                    var width = 34;
                    var height = 24;
                    var segments = 20;
                    ctx.beginPath();
                    _.times(segments + 1, function (idx) {
                        var angle = (idx / segments) * Math.PI * 2;
                        var wobbleX = 1 + 0.08 * Math.sin(angle * 4);
                        var wobbleY = 1 + 0.12 * Math.cos(angle * 5);
                        var px = x + (width * wobbleX * Math.cos(angle));
                        var py = y + (height * wobbleY * Math.sin(angle));
                        if (idx === 0) {
                            ctx.moveTo(px, py);
                        } else {
                            ctx.lineTo(px, py);
                        }
                    });
                    ctx.closePath();
                };

                var drawMarker = function (marker) {
                    if (!marker) return;
                    ctx.save();
                    applyDrawingClip();
                    if (marker.tool === 'os') {
                        ctx.strokeStyle = '#111111';
                        ctx.lineWidth = 2;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                    if (marker.tool === 'cancer') {
                        var radius = marker.size || 18;
                        ctx.fillStyle = '#111111';
                        ctx.strokeStyle = '#111111';
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        _.times(25, function (idx) {
                            var angle = (idx / 24) * Math.PI * 2;
                            var wobble = 1 + 0.13 * Math.sin(angle * 6);
                            var px = marker.x + (radius * wobble * Math.cos(angle));
                            var py = marker.y + (radius * wobble * Math.sin(angle));
                            if (idx === 0) {
                                ctx.moveTo(px, py);
                            } else {
                                ctx.lineTo(px, py);
                            }
                        });
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                    if (marker.tool === 'scj') {
                        ctx.strokeStyle = '#111111';
                        ctx.lineWidth = 2;
                        ctx.fillStyle = 'transparent';
                        drawScjShape(marker.x, marker.y);
                        ctx.stroke();
                    }
                    if (marker.tool === 'epithelium') {
                        ctx.fillStyle = 'rgba(120, 120, 120, 0.22)';
                        ctx.strokeStyle = 'rgba(90, 90, 90, 0.85)';
                        ctx.lineWidth = 1.2;
                        drawEpitheliumShape(marker.x, marker.y);
                        ctx.fill();
                        ctx.stroke();
                        var minX = marker.x - 24;
                        var minY = marker.y - 16;
                        var maxX = marker.x + 24;
                        var maxY = marker.y + 16;
                        var step = 8;
                        for (var dotX = minX; dotX <= maxX; dotX += step) {
                            for (var dotY = minY; dotY <= maxY; dotY += step) {
                                var dx = dotX - marker.x;
                                var dy = dotY - marker.y;
                                if (((dx * dx) / (24 * 24)) + ((dy * dy) / (16 * 16)) <= 1) {
                                    ctx.beginPath();
                                    ctx.fillStyle = 'rgba(90, 90, 90, 0.5)';
                                    ctx.arc(dotX, dotY, 1.2, 0, Math.PI * 2);
                                    ctx.fill();
                                }
                            }
                        }
                    }
                    ctx.restore();
                };

                var redraw = function () {
                    if (!canvas.width || !canvas.height) return;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    _.each(scope.drawing.strokes, function (stroke) {
                        drawStroke(stroke);
                    });
                    _.each(scope.drawing.markers, function (marker) {
                        drawMarker(marker);
                    });
                    if (currentStroke) {
                        drawStroke(currentStroke);
                    }
                };

                var hasDrawingValue = function (drawing) {
                    return drawing.strokes.length > 0 || drawing.markers.length > 0;
                };

                var pushHistory = function () {
                    scope.history.push(cloneDrawing(scope.drawing));
                    if (scope.history.length > 50) {
                        scope.history.shift();
                    }
                };

                var saveValue = function () {
                    if (hasDrawingValue(scope.drawing)) {
                        scope.observation.value = JSON.stringify(scope.drawing);
                    } else {
                        scope.observation.value = null;
                    }
                    redraw();
                    scope.$applyAsync();
                };

                var getCanvasPoint = function (event) {
                    var sourceEvent = event.touches && event.touches.length ? event.touches[0] : event;
                    var rect = canvas.getBoundingClientRect();
                    return {
                        x: sourceEvent.clientX - rect.left,
                        y: sourceEvent.clientY - rect.top
                    };
                };

                var addPointToStroke = function (point) {
                    if (!currentStroke) return;
                    currentStroke.points.push(normalizePoint(point));
                    redraw();
                };

                var startStroke = function (point) {
                    var tool = scope.selectedTool;
                    if (!tool) {
                        return;
                    }
                    if (!pointInsideCircle(point)) {
                        return;
                    }
                    if (tool === 'os' || tool === 'cancer') {
                        pushHistory();
                        var marker = {
                            tool: tool,
                            x: Math.round(point.x),
                            y: Math.round(point.y)
                        };
                        if (tool === 'cancer') {
                            marker.size = getBrushSize(tool) * 1.5;
                        }
                        scope.drawing.markers.push(marker);
                        saveValue();
                        return;
                    }

                    currentStroke = {
                        tool: tool,
                        size: getBrushSize(tool),
                        color: toolConfig[tool].color,
                        composite: toolConfig[tool].composite,
                        points: [normalizePoint(point)]
                    };
                    isDrawing = true;
                    redraw();
                };

                var stopStroke = function () {
                    if (!currentStroke) {
                        isDrawing = false;
                        return;
                    }
                    pushHistory();
                    scope.drawing.strokes.push(currentStroke);
                    currentStroke = null;
                    isDrawing = false;
                    saveValue();
                };

                var handlePointerDown = function (event) {
                    if (scope.fixed) return;
                    event.preventDefault();
                    startStroke(getCanvasPoint(event));
                };

                var handlePointerMove = function (event) {
                    if (scope.fixed || !isDrawing || !currentStroke) return;
                    event.preventDefault();
                    var point = getCanvasPoint(event);
                    if (!pointInsideCircle(point)) return;
                    addPointToStroke(point);
                };

                var handlePointerUp = function () {
                    if (scope.fixed || !isDrawing) return;
                    stopStroke();
                };

                var resizeCanvas = function () {
                    var width = surfaceEl && surfaceEl.clientWidth ? surfaceEl.clientWidth : 520;
                    var height = Math.round(width * 0.72);
                    scope.surfaceHeight = height;
                    canvas.width = width;
                    canvas.height = height;
                    redraw();
                };

                scope.setTool = function (tool) {
                    scope.selectedTool = tool;
                    if (toolDefaultSizes[tool]) {
                        scope.selectedBrushSize = toolDefaultSizes[tool];
                    }
                };

                scope.isToolSelected = function (tool) {
                    return scope.selectedTool === tool;
                };

                scope.setBrushSize = function (size) {
                    scope.selectedBrushSize = size;
                };

                scope.getCursor = function () {
                    if (scope.fixed) {
                        return 'default';
                    }
                    if (!scope.selectedTool) {
                        return 'default';
                    }
                    return scope.selectedTool === 'os' ? 'pointer' : 'crosshair';
                };

                scope.undo = function () {
                    if (scope.fixed || !scope.history.length) return;
                    var previous = scope.history.pop();
                    scope.drawing = previous ? previous : cloneDrawing({
                        version: 2,
                        strokes: [],
                        markers: []
                    });
                    currentStroke = null;
                    if (hasDrawingValue(scope.drawing)) {
                        scope.observation.value = JSON.stringify(scope.drawing);
                    } else {
                        scope.observation.value = null;
                    }
                    redraw();
                };

                scope.clearAll = function () {
                    if (scope.fixed) return;
                    scope.history.push(cloneDrawing(scope.drawing));
                    scope.drawing = {
                        version: 2,
                        strokes: [],
                        markers: []
                    };
                    currentStroke = null;
                    scope.observation.value = null;
                    redraw();
                };

                scope.drawing = parseSavedValue();
                $timeout(function () {
                    resizeCanvas();
                });

                var winEl = angular.element($window);
                var docEl = angular.element($window.document);
                winEl.on('resize', resizeCanvas);
                canvas.addEventListener('mousedown', handlePointerDown);
                canvas.addEventListener('mousemove', handlePointerMove);
                canvas.addEventListener('touchstart', handlePointerDown, {passive: false});
                canvas.addEventListener('touchmove', handlePointerMove, {passive: false});
                docEl.on('mouseup', handlePointerUp);
                docEl.on('touchend', handlePointerUp);
                scope.$on('$destroy', function () {
                    winEl.off('resize', resizeCanvas);
                    docEl.off('mouseup', handlePointerUp);
                    docEl.off('touchend', handlePointerUp);
                    canvas.removeEventListener('mousedown', handlePointerDown);
                    canvas.removeEventListener('mousemove', handlePointerMove);
                    canvas.removeEventListener('touchstart', handlePointerDown);
                    canvas.removeEventListener('touchmove', handlePointerMove);
                });
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/cervicalMap.html'
        };
    }]);
