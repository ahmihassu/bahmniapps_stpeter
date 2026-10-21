'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('graph', ['$window', '$http', '$document', function ($window, $http, $document) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                patient: '=',
                roo: "=?",
                fixed: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                let today = new Date();
                today.setMilliseconds(0);
                today.setSeconds(0);
                $scope.currentTime = {
                    value: today
                };
                $scope.spBars = []; // the set representing the two headed arrows
                $scope.inputTypes = [{
                    name: "Fetal Heart Beat",
                    currentData: 0
                }];
                let points = {};
                let rows = 12;      //  number of rows in the table, default set to 12
                $scope.graphType = "fhr";    // fetal heart rate set as default
                $scope.isWarning = function (givenPoint) {
                    return (!givenPoint.fixed && (givenPoint.value >= 180 || givenPoint.value <= 100));
                };
                let rowValue = 10;
                let rowInit = 80;
                let rowTerm = 200;
                let otherLines = [];
                let timeShift = 0;

                if ($scope.observation.concept.name.includes("Cervical")) {
                    $scope.inputTypes = [{
                        name: "Cervix (cm)",
                        currentData: 0
                    },
                    {
                        name: "Descent of Head",
                        currentData: 0,
                        color: "red",
                        noCheck: true,
                        style: {"background-color": "red"}
                    }
                    ];
                    rows = 10;
                    $scope.graphType = "cd";
                    rowValue = 1;
                    rowInit = 0;
                    rowTerm = 10;
                    otherLines.push([{time: 0, value: 4, fixed: true}, {time: 360, value: 10, fixed: true}]);
                    otherLines.push([{time: 240, value: 4, fixed: true}, {time: 600, value: 10, fixed: true}]);
                }

                if ($scope.observation.concept.name.includes("Pulse")) {
                    $scope.inputTypes = [{
                        name: "Systolic",
                        currentData: 0,
                        style: {"background-color": "transparent"}
                    },
                    {
                        name: "Diastolic",
                        currentData: 0,
                        style: {"background-color": "transparent"}
                    },
                    {
                        name: "Pulse",
                        currentData: 0,
                        color: "red",
                        style: {"background-color": "red"}
                    }
                    ];
                    rows = 22;
                    $scope.graphType = "pbp";
                    rowValue = 10;
                    rowInit = 30;
                    rowTerm = 250;
                    $scope.isWarning = function (givenPoint) {
                        return false;
                    };
                }

                $scope.inputTypes.forEach(element => {
                    points[element.name] = [];
                });

                let getDateTime = function (time) {
                    if (!time) return null;
                    let strippedDateTime = new Date(0);
                    strippedDateTime.setMinutes(time.split(":")[1]);
                    strippedDateTime.setHours(time.split(":")[0]);
                    return strippedDateTime;
                };

                $scope.addCurrent = function () {
                    $scope.resultMessage = {message: "", style: ""};
                    let diffMs = 0; 
                    if($scope.startTimeFixed){
                        $scope.startTime = new Date($scope.startTimeFixed);
                    }
                    else {
                       let startTimeb = getDateTime($scope.roo?.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                       $scope.startTime = new Date(startTimeb);
                    }
                    // $scope.startTime = $scope.startTimeFixed || getDateTime($scope.roo.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                    diffMs = Math.round((getDateTime($scope.currentTime.value) - $scope.startTime) / 60000);
                    let validity = {};
                    if($scope.graphType ==='pbp'){
                        validity = checkValidPbp(diffMs, points, $scope.inputTypes, rowInit, rowTerm);

                        if (validity.valid) {
                            const { systolic, diastolic, pulse } = validity.data;

                            // Push values conditionally
                            if (systolic !== "N/A")
                                points["Systolic"].push({ time: diffMs, value: systolic });
                            if (diastolic !== "N/A")
                                points["Diastolic"].push({ time: diffMs, value: diastolic });
                            if (pulse !== "N/A")
                                points["Pulse"].push({ time: diffMs, value: pulse, color: "red" });

                            // Sort and save
                            Object.keys(points).forEach(k => points[k].sort((a, b) => a.time - b.time));
                            $scope.observation.groupMembers[0].value = JSON.stringify(points);
                            drawAll();
                            $scope.inputTypes.forEach(element => {
                                element.currentData = null;
                            });
                        }
                        $scope.resultMessage = validity;
                    }else{
                        $scope.inputTypes.every(element => {
                        validity = checkValid(diffMs + timeShift, points[element.name].length, element.name, element.currentData);
                        return validity.valid;
                        });
                        if (validity.valid) {
                            $scope.inputTypes.forEach(element => {
                                points[element.name].push({time: diffMs, value: element.currentData, color: element.color, noCheck: element.noCheck});
                                points[element.name].sort(function (a, b) { return a.time - b.time; });
                            });
                            $scope.observation.groupMembers[0].value = JSON.stringify(points);
                            drawAll();
                        }
                        $scope.resultMessage = validity;
                }
                };

                var checkValid = function (diffMs, pointsLen, label, currentData) {
                    if (!currentData || currentData > rowTerm || currentData < rowInit) {
                        return {valid: false, message: `The value you entered for ${label} is invalid`, style: {"background-color": "rgba(255, 0, 0, 0.25)"}};
                    }
                    if (pointsLen === 0 && $scope.graphType === "cd") {
                        if (diffMs !== 0) {
                            return {valid: false, message: "The first entry must have the same time as the partograph start time.", style: {"background-color": "rgba(255, 0, 0, 0.25)"}};
                        }
                    }
                    else {
                        if (diffMs < timeShift || diffMs > 720) {
                            return {valid: false, message: "The time entered must be in the 12 hour period after the partograph start time.", style: {"background-color": "rgba(255, 0, 0, 0.25)"}};
                        }
                    }
                    return {valid: true, message: "Data added to graph", style: {"background-color": "rgba(0, 255, 0, 0.25)"}};
                };

                var checkValidPbp = function (diffMs, points, inputTypes, rowInit, rowTerm) {
                    let systolic = inputTypes.find(i => i.name === "Systolic")?.currentData || 0;
                    let diastolic = inputTypes.find(i => i.name === "Diastolic")?.currentData || 0;
                    let pulse = inputTypes.find(i => i.name === "Pulse")?.currentData || 0;


                    if (diffMs < timeShift || diffMs > 720) {
                        return {
                            valid: false,
                            message: "The time entered must be in the 12 hour period after the partograph start time.",
                            style: {"background-color": "rgba(255, 0, 0, 0.25)"}
                        };
                    }

                    
                    else if ((systolic >= 40 && systolic <= rowTerm) && (diastolic >= 40 && diastolic <= rowTerm) && (pulse >= 40 && pulse <=rowTerm) ) {                        
                        return {
                            valid: true,
                            message: "Systolic, Diastolic, and Pulse added.",
                            style: {"background-color": "rgba(0, 255, 0, 0.25)"},
                            data: { systolic, diastolic, pulse, emphasize: false }
                        };
                    }

                    else if (systolic >= 40 && systolic <= rowTerm && diastolic >= 40 && diastolic <= rowTerm &&(!pulse || pulse === 0)) {
                        return {
                            valid: true,
                            message: "Systolic & Diastolic added. Pulse skipped (N/A).",
                            style: {"background-color": "rgba(0, 255, 0, 0.25)"},
                            data: { systolic, diastolic, pulse: "N/A", emphasize: false }
                        };
                    }

                    else if ((pulse > 0 && pulse <= rowTerm) && (!systolic || systolic === 0) && (!diastolic || diastolic === 0)) {
                        if (pulse < 40) {
                            return {
                                valid: true,
                                message: "Pulse recorded as Unrecordable (<40).",
                                style: {"background-color": "rgba(255, 165, 0, 0.25)"},
                                data: { systolic: "N/A", diastolic: "N/A", pulse:30, emphasize: true }
                            };
                        }

                        return {
                            valid: true,
                            message: "Pulse added. Systolic & Diastolic skipped (N/A).",
                            style: {"background-color": "rgba(0, 255, 0, 0.25)"},
                            data: { systolic: "N/A", diastolic: "N/A", pulse, emphasize: false }
                        };
                    }

                    return {
                        valid: false,
                        message: "Please enter either valid values for Systolic & Diastolic (>40) or a Pulse value(>0).",
                        style: {"background-color": "rgba(255, 0, 0, 0.25)"},
                        data: {}
                    };
                };



                $scope.yaxisStyle = {"height": (100 + 100 / rows) + '%'};

                var fetchData = function (patientUuid, formGroup, customRepresentation) {
                    var params = {
                        patient: patientUuid,
                        limit:1,
                        numberOfVisits: 1,
                        v: customRepresentation,
                        conceptNames: formGroup
                    };
                    return $http.get(Bahmni.Common.Constants.openmrsObsUrl, {params: params});
                };

                let clear = function () {
                    $scope.points = [];
                    $scope.lines = [];
                    $scope.spBars = [];
                };

                let draw = function (givenPoints, name) {
                    if (name === "Cervix (cm)") {
                        timeShift = (givenPoints[0].value - 4) * 60;
                        $scope.timeLabels = generateTimeLabels();
                        $scope.isWarning = function (gp) {
                            return (!gp.fixed && !gp.noCheck && !(gp.value > (gp.time + timeShift) / 60));
                        };
                    }
                    let previousPoint = {};

                    givenPoints.forEach(element => {
                        let actualShift = 0;
                        let color = "transparent";
                        if (!element.fixed) actualShift = timeShift;
                        let y = 100 - ((element.value - rowInit) * 100 / (rows * rowValue));
                        let x = (element.time + actualShift) * 5 / 36;
                        let linex = x - previousPoint.x;
                        let liney = previousPoint.y - y;
                        let lineyAct = liney + '%';
                        let scale = 1;


                        if (liney < 0) {
                            liney = -liney;
                            scale = -1;
                            lineyAct = liney + '%';
                        }
                        else if (liney === 0) {
                            liney = 2;
                            color = element.color || "black";
                            lineyAct = liney + 'px';
                        }
                        $scope.points.push({
                            "style": {
                                "top": y + "%",
                                "left": x + "%",
                                "transform": 'translate(-2.5px, -2.5px)'
                            },
                            "isWarning": $scope.isWarning(element)
                        });
                        
                        if (element.value===30 && name==='Pulse'){
                        $scope.points.push({
                            "style": {
                                "top": y + "%",
                                "left": x + "%",
                                "width": "10px",
                                "height": "10px",
                                "border-radius": "50%",
                                "background-color": "red",
                                "box-shadow": "0 0 6px 2px rgba(255, 0, 0, 0.6)",
                                "transform": "translate(-5px, -5px)"
                            },
                            "isWarning": $scope.isWarning(element)
                        });

                        }

                        $scope.lines.push({
                            "line": {
                                "top": y + "%",
                                "left": (x - linex) + "%",
                                "height": lineyAct,
                                "width": linex + '%',
                                "transform-origin": 'top right',
                                "transform": `scale(1 , ${scale})`,
                                "background-color": color,
                                "background":
                                                `linear-gradient(to top left,
                                                    ${color} 0%,
                                                    ${color} calc(50% - 2px),
                                                    ${element.color || "black"} 50%,
                                                    ${color} calc(50% + 2px),
                                                    ${color} 100%)`
                            }});
                        previousPoint = {x: x, y: y};
                    });
                };

                let drawSpecial = function () {
                    draw(points[$scope.inputTypes[2].name], $scope.inputTypes[2].name);
                    let diastolics = points[$scope.inputTypes[1].name];
                    let systolics = points[$scope.inputTypes[0].name];
                    diastolics.forEach((point, index) => {
                        let y = 100 - ((point.value - rowInit) * 100 / (rows * rowValue));
                        let x = (point.time) * 5 / 36;
                        let y2 = 100 - ((systolics[index].value - rowInit) * 100 / (rows * rowValue));
                        $scope.spBars.push({
                            "style": {
                                "top": y2 + "%",
                                "left": x + "%",
                                "height": Math.abs(y2 - y) + "%",
                                "transform": 'translate(-1.5%, 0)'
                            }
                        });
                    });
                };

                $scope.cells = [];
                $scope.ylabels = [];

                // for (let index = 0; index < rows * 24; index++) {
                //     $scope.cells.push({
                //         "style": {
                //             "height": 100 / rows + '%'
                //         }
                //     });
                // }

                // for (let value = rowTerm; value >= rowInit; value = value - rowValue) {
                //     $scope.ylabels.push({
                //         "label": value,
                //         "style": {"height": 100 / rows + '%'}
                //     });
                // }

                let groupMembers = [];
                $scope.observation.groupMembers.forEach(element => {
                    groupMembers.push(element.concept.name);
                });
            
               fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(groupMembers)").then(res => {
                    if ($scope.observation.groupMembers[0].value) {
                        points = JSON.parse($scope.observation.groupMembers[0].value);
                        drawAll();
                    }
                    else if (res.data.results.length) {
                        points = JSON.parse(res.data.results[0].groupMembers[0].value);
                        let targetObs = $scope.observation.groupMembers[0];
                        targetObs.value = JSON.stringify(points);
                        drawAll();
                    }
                    else {
                        $scope.points = [];
                        $scope.lines = [];
                        otherLines.forEach(element => {
                            draw(element);
                        });
                    }
                });
                if ($scope.graphType !== "an") {
                    fetchData($scope.patient.uuid, ["Partograph Start Time"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.startTimeFixed = new Date(res.data.results[0].value.split("+")[0]);
                            $scope.$root.$broadcast("refreshTime", {"time": res.data.results[0].value});
                            $scope.timeLabels = generateTimeLabels()
                        }
                    });
                }
                if ($scope.graphType === "pbp") {
                    fetchData($scope.patient.uuid, ["Labor starting time"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.$root.$broadcast("refreshDateTime", {"time": res.data.results[0].value, "type": "Labor starting time"});
                        }
                    });                    
                    fetchData($scope.patient.uuid, ["If membrane is ruptured, time of ROM"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.$root.$broadcast("refreshDateTime", {"time": res.data.results[0].value, "type": "If membrane is ruptured, time of ROM"});
                        }
                    });
                }
                var generateTimeLabels = function () {
                    let timeLabels = [];
                    let startTime;
                    if($scope.startTimeFixed){
                        startTime = new Date($scope.startTimeFixed);
                    }
                    else{
                       let startTimeb = getDateTime($scope.roo?.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                       startTime = new Date(startTimeb);
                       console.log(startTimeb);
                    }
                    if (!startTime ) {
                        return timeLabels;
                    }
                    startTime.setMinutes(startTime.getMinutes() - timeShift);
                    for (let index = 0; index < 24; index++) {
                        timeLabels.push(moment(startTime).format("hh:mm"));
                        startTime.setMinutes(startTime.getMinutes() + 30);
                    }
                    
                    return timeLabels;
                };
                var drawAll = function () {
                    clear();
                    if ($scope.graphType === "pbp") {
                        drawSpecial();
                        $scope.timeLabels = generateTimeLabels();
                        return;
                    }
                    $scope.inputTypes.forEach(element => {
                        draw(points[element.name], element.name);
                    });
                    otherLines.forEach(element => {
                        draw(element);
                    });

                    if ($scope.graphType !== "an") {
                        $scope.timeLabels = generateTimeLabels();
                    }
                    
                };

                $scope.invBars = [];
                $scope.freeTokens = [];
                $scope.shadedRegions = [];
                $scope.anaesthesiaStartTimeTemp;
                let anaesthesiaDelim = "⊙";
                $scope.anaesthesiaStartTime;
                $scope.lines = [];
                $scope.parentGraphStyle = {
                    width: '100%',
                    "min-width": 'max(50vw, 750px)',
                }
                $scope.plotAreaStyle = {}
                let cols;
                var getAnesthesiaLabels = function () {
                    let labels = ["Time", ""];
                    $scope.medications = [];
                    $scope.allDrugs = [];
                    $scope.observation.groupMembers[1].groupMembers.forEach((element, index) => {
                        labels.push(shave_string(element.label, 15));
                        $scope.allDrugs.push(element.label)
                        $scope.medications.push({
                            name: element.label,
                            value: index,
                        });
                    });
                    return labels;
                };
                var shave_string = function (str, max) {
                    if (str.length > max) {
                        return str.substring(0, max - 3) + '...';
                    }
                    return str;
                };
                let insertAnesthesiaLabels = function () {
                    let labels = [];
                    let labelAdjustment =  3;
                    if ($scope.roo) {
                        labels = getAnesthesiaLabels()
                        $scope.graphData.labels = labels;
                    }
                    else {
                        labels = $scope.graphData.labels;
                        labelAdjustment = 3;
                    }
                    rows = labels.length;
                    for (let index = 0; index < rows * cols; index++) {
                        let test_num = ((index - 2) / cols) - 4
                        let content = ""
                        let contentStyle = {}
                        if (Number.isInteger(test_num) && test_num >= 0 && test_num < 20) {
                            content = content + (200 - test_num * 10)
                        }
                        if (index < cols - 3 && index > 2 && (index - 2) % 6 != 0) {
                            content = "" + ((index - 2) % 6) * 10
                            contentStyle = {
                                position: "relative",
                                "left": "70%"
                            }
                        }
                        test_num = ((index - 1) / cols) - 15
                        if (Number.isInteger(test_num) && test_num >= 0 && test_num < 8) {
                            content = content + (91 - test_num * 10)
                        }
                        $scope.cells.push({
                            "style": {
                                "height": 100 / rows + '%',
                                "width": 100 / cols + '%'
                            },
                            "content": content,
                            "contentStyle": contentStyle,
                        });
                    }
                    labels.forEach(label => {
                        $scope.ylabels.push({
                            "label": label,
                            "style": {
                                "height": 100 / (rows + labelAdjustment) + '%',
                                "max-height": 100 / (rows + labelAdjustment) + '%',
                                "margin-left": "-100%",
                                "padding-top": "50%",
                            },
                            "hideGradiation": true
                        });
                    });
                    $scope.parentGraphStyle.height = 100 / rows + '%';
                    $scope.plotAreaStyle.height = "200vh"
                    $scope.plotAreaStyle.marginLeft = 100 / cols + '%';
                }
                if ($scope.observation.concept.name.includes("Anaesthesia")) {
                    $scope.graphData = {
                        "startTime": undefined,
                        "points": {
                            "pulse":[]
                        },
                        "drugs": [],
                        "bars": [],
                        "opt":[],
                        "ipt":[],
                        "anst":[]
                    }
                    
                    $scope.inputTypes = [];
                    cols = 29;
                    $scope.graphType = "an";
                    if ($scope.roo) {
                        insertAnesthesiaLabels()
                    }
                }

                // ── localStorage helpers ─────────────────────────────────────
                // Scoped to patient+concept so sessions never bleed across
                // patients or chart types. Declared here (before getAnaesthesia)
                // so getAnaesthesia can call loadFromLocalStorage / clearLocalStorage.
                let _storageKey = 'bahmni_an_draft_' +
                    $scope.patient.uuid + '_' +
                    $scope.observation.concept.name.replace(/\s+/g, '_');
                let saveToLocalStorage = function () {
                    try {
                        localStorage.setItem(_storageKey, JSON.stringify($scope.graphData));
                    } catch (e) { /* ignore QuotaExceededError */ }
                };
                let loadFromLocalStorage = function () {
                    try {
                        let raw = localStorage.getItem(_storageKey);
                        return raw ? JSON.parse(raw) : null;
                    } catch (e) { return null; }
                };
                let clearLocalStorage = function () {
                    try { localStorage.removeItem(_storageKey); } catch (e) {}
                };
                // ─────────────────────────────────────────────────────────────

                // Ensure every required array/object field exists so code that
                // accesses .length or .forEach never throws on old/partial data.
                let normalizeGraphData = function (data) {
                    if (!data) data = {};
                    return {
                        startTime:  data.startTime  || undefined,
                        completed:  data.completed  || false,
                        labels:     data.labels     || [],
                        points:     { pulse: (data.points && Array.isArray(data.points.pulse)) ? data.points.pulse : [] },
                        drugs:      Array.isArray(data.drugs) ? data.drugs : [],
                        bars:       Array.isArray(data.bars)  ? data.bars  : [],
                        opt:        Array.isArray(data.opt)   ? data.opt   : [],
                        ipt:        Array.isArray(data.ipt)   ? data.ipt   : [],
                        anst:       Array.isArray(data.anst)  ? data.anst  : []
                    };
                };

                let loadAnesthesiaState = function (data) {
                    $scope.graphData = normalizeGraphData(data);
                    $scope.sessionCompleted = !!$scope.graphData.completed;
                    if ($scope.graphData.startTime) {
                        $scope.anaesthesiaChartStartTime = new Date($scope.graphData.startTime);
                        $scope.abStc = $scope.anaesthesiaChartStartTime;
                        if ($scope.graphData.anst.length > 0) {
                            $scope.anaesthesiaStartTime = new Date($scope.graphData.anst[0]);
                            $scope.abSt = $scope.anaesthesiaStartTime;
                        }
                        if ($scope.graphData.anst.length > 1) {
                            $scope.anaesthesiaEndTime = new Date($scope.graphData.anst[1]);
                            $scope.abEt = $scope.anaesthesiaEndTime;
                        }
                        if ($scope.graphData.opt.length > 0) {
                            $scope.surgeryStartTime = new Date($scope.graphData.opt[0]);
                            $scope.surSt = $scope.surgeryStartTime;
                        }
                        if ($scope.graphData.opt.length > 1) {
                            $scope.surgeryEndTime = new Date($scope.graphData.opt[1]);
                            $scope.surEt = $scope.surgeryEndTime;
                        }
                        if ($scope.graphData.ipt.length > 0) {
                            $scope.intubationStartTime = new Date($scope.graphData.ipt[0]);
                            $scope.intSt = $scope.intubationStartTime;
                        }
                        if ($scope.graphData.ipt.length > 1) {
                            $scope.intubationEndTime = new Date($scope.graphData.ipt[1]);
                            $scope.intEt = $scope.intubationEndTime;
                        }
                    }
                    drawAnesthesia();
                };

                let getAnaesthesia = function () {
                    // Always do the server fetch first so the observation binding
                    // is populated.  The localStorage check runs INSIDE the .then()
                    // so that all `let` declarations (including drawAnesthesia) are
                    // guaranteed to be initialised before we call them.
                    fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(groupMembers)").then(res => {
                        // Restore a localStorage draft ONLY if it has a startTime
                        // (i.e. the user actually began a session).  An empty draft
                        // written by "Start New Session" has startTime=undefined and
                        // must NOT override real server data.
                        let localDraft = loadFromLocalStorage();
                        if (localDraft && !localDraft.completed && localDraft.startTime) {
                            // Push the draft into the observation binding so Bahmni
                            // Save will include it when the user eventually saves.
                            $scope.observation.groupMembers[0].value = JSON.stringify(localDraft);
                            loadAnesthesiaState(localDraft);
                            return;
                        }

                        // No active local draft — fall back to server data.
                        if ($scope.observation.groupMembers[0].value) {
                            clearLocalStorage();
                            loadAnesthesiaState(JSON.parse($scope.observation.groupMembers[0].value));
                        }
                        else if (res.data.results.length) {
                            clearLocalStorage();
                            loadAnesthesiaState(JSON.parse(res.data.results[0].groupMembers[0].value));
                        }
                    });
                };
                if ($scope.graphType == "an") {
                    getAnaesthesia();
                }

                const AN_CHART_MIN_SPAN_MINUTES = 240;
                const AN_CHART_COLS_PADDING = 5;

                let getAnesthesiaTimeFromValue = function (value) {
                    if (!value) {
                        return null;
                    }
                    if (value instanceof Date) {
                        return stripDate(value);
                    }
                    return getDateTime(value);
                };

                let findMinutesFromChartStart = function (endDate) {
                 let start = stripDate($scope.anaesthesiaChartStartTime);
                    let end = stripDate(endDate);
                    return Math.floor((end - start) / 60000);
                };

                let getAnesthesiaChartSpanMinutes = function (extraMinutes) {
                    let span = AN_CHART_MIN_SPAN_MINUTES;
                    if (!$scope.anaesthesiaChartStartTime) {
                        return span;
                    }
                    let consider = function (value) {
                        let date = getAnesthesiaTimeFromValue(value);
                        if (!date) {
                            return;
                        }
                        let minutes = findMinutesFromChartStart(date);
                        if (minutes > span) {
                            span = minutes;
                        }
                    };
                    if ($scope.graphData) {
                        $scope.graphData.bars.forEach(function (bar) { consider(bar[2]); });
                        $scope.graphData.points.pulse.forEach(function (point) { consider(point[1]); });
                        $scope.graphData.drugs.forEach(function (drug) { consider(drug[2]); });
                        $scope.graphData.anst.forEach(consider);
                        $scope.graphData.opt.forEach(consider);
                        $scope.graphData.ipt.forEach(consider);
                    }
                    if (extraMinutes != null && extraMinutes > span) {
                        span = extraMinutes;
                    }
                    return Math.max(AN_CHART_MIN_SPAN_MINUTES, Math.ceil((span + 10) / 60) * 60);
                };

                let getAnesthesiaCols = function (spanMinutes) {
                    return Math.max(24, Math.ceil(spanMinutes / 10)) + AN_CHART_COLS_PADDING;
                };

                let rebuildAnesthesiaGridIfNeeded = function (extraMinutes) {
                    if ($scope.graphType !== "an") {
                        return;
                    }
                    let newCols = getAnesthesiaCols(getAnesthesiaChartSpanMinutes(extraMinutes));
                    if (newCols === cols && $scope.cells.length > 0) {
                        return;
                    }
                    cols = newCols;
                    $scope.cells = [];
                    $scope.ylabels = [];
                    insertAnesthesiaLabels();
                };

                let getTimeForValidation = function (time) {
                    if (time) {
                        return time instanceof Date ? stripDate(time) : getDateTime(time);
                    }
                    return getDateTime($scope.currentTime.value);
                };

                let checkTimeValid = function (time) {
                    if (!$scope.anaesthesiaChartStartTime) {
                        $scope.resultMessage = {
                            valid: false,
                            message: "Set Anaesthesia Chart Start Time first",
                            style: {
                                "background-color": "rgba(255, 0, 0, 0.25)"
                            }
                        };
                        return false;
                    }
                    let entryTime = getTimeForValidation(time);
                    if (!entryTime) {
                        return false;
                    }
                    let minutes = findMinutesFromChartStart(entryTime);
                    if (minutes < 0) {
                        $scope.resultMessage = {
                            valid: false,
                            message: "The time must be on or after the chart start time",
                            style: {
                                "background-color": "rgba(255, 0, 0, 0.25)"
                            }
                        };
                        return false;
                    }
                    rebuildAnesthesiaGridIfNeeded(minutes);
                    return true;
                }
                let checkBloodPressureValid = function (systolic, diastolic) {
                    if (!systolic || systolic < 10 || systolic > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Systolic Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    if (!diastolic || diastolic < 10 || diastolic > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Diastolic Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    if (systolic <= diastolic) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `The value for diastolic should not be greater than the value for systolic`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    return true;
                }
                let checkPulseValid = function (pulse) {
                    if (!pulse || pulse < 10 || pulse > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Pulse Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    return true;
                }
                var stripDate = function (date) {
                    let zeroDate = new Date(0);
                    zeroDate.setHours(date.getHours())
                    zeroDate.setMinutes(date.getMinutes())
                    return zeroDate
                }
                $scope.setAnChartTime = function (abSt) {
                    if (abSt) {
                        $scope.anaesthesiaChartStartTime = abSt;
                        $scope.graphData.startTime = abSt;
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setAnTime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.anaesthesiaStartTime = abSt;
                        $scope.graphData.anst.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setAnETime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.anaesthesiaEndTime = abSt;
                        $scope.graphData.anst.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setSurTime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.surgeryStartTime = abSt;
                        $scope.graphData.opt.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setSurETime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.surgeryEndTime = abSt;
                        $scope.graphData.opt.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setIntTime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.intubationStartTime = abSt;
                        $scope.graphData.ipt.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setIntETime = function (abSt) {
                    if (abSt && checkTimeValid(abSt)) {
                        $scope.intubationEndTime = abSt;
                        $scope.graphData.ipt.push(abSt);
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setBloodPressure = function (systolic, diastolic) {
                    if (checkTimeValid() && checkBloodPressureValid(systolic, diastolic)) {
                        let individual_bar = [systolic, diastolic, $scope.currentTime.value]
                        $scope.graphData.bars.push(individual_bar);
                        $scope.graphData.bars.sort(function (a, b) {
                            return getDateTime(a[2]) - getDateTime(b[2])
                        })
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                let findMinutes = function (startDate, endDate) {
                    let start = stripDate(startDate);
                    let end = stripDate(endDate);
                    let diff = Math.abs(end - start) / 1000;
                    return Math.floor(diff / 60);
                }
                let getXValue = function (date) {
                    let minutes = Math.max(0, findMinutesFromChartStart(date)) + 30;
                    return minutes * 10 / cols
                }
                let placeToken = function (token, date) {
                    let width = 10;
                    let height = 5;
                    $scope.freeTokens.push({
                        "value": token,
                        "style": {
                            "position": "absolute",
                            "z-index": 99,
                            "width": width + "%",
                            "left": (getXValue(date) - (width/2)) + "%",
                            "top": ((100 / (rows + 1)) - 0.3) + "%",
                            "font-size": "xx-large",
                            "text-align": "center"
                        } 
                    })
                }
                let placeTokens = function () {
                    $scope.freeTokens = [];
                    $scope.graphData.anst.forEach(token => {
                        placeToken("X", new Date(token));
                    });
                    $scope.graphData.opt.forEach(token => {
                        placeToken(anaesthesiaDelim, new Date(token));
                    }); 
                    $scope.graphData.ipt.forEach(token => {
                        placeToken("I", new Date(token));
                    });                 
                }
                let placeInvertedBar = function (bar) {
                    let diastolic = bar[1];
                    let systolic = bar[0];
                    let ys = (240 - systolic) * 10 / rows
                    let yd = (240 - diastolic) * 10 / rows
                    let x = getXValue(getDateTime(bar[2]));
                    $scope.invBars.push({
                        "style": {
                            "top": ys + "%",
                            "left": x + "%",
                            "height": Math.abs(yd - ys) + "%",
                            "transform": 'translate(-1.5%, 0)',
                        }
                    });
                }
                let placeShadedRegion = function (previousBar, currentBar) {
                    if (previousBar) {
                        let xp = getXValue(getDateTime(previousBar[2]));
                        let yps = (240 - previousBar[0]) * 10 / rows
                        let ypd = (240 - previousBar[1]) * 10 / rows
                        let xc = getXValue(getDateTime(currentBar[2]));
                        let ycs = (240 - currentBar[0]) * 10 / rows
                        let ycd = (240 - currentBar[1]) * 10 / rows
                        let x = xp
                        let y = Math.min(yps, ycs)
                        let height = Math.max(ypd, ycd) - y
                        let width = getXValue(getDateTime(currentBar[2])) - x
                        $scope.shadedRegions.push({
                            "position": "absolute",
                            "top": y + "%",
                            "left": x + "%",
                            "background-color": "rgba(0, 255, 0, 0.25)",
                            "height": height + "%",
                            "width": width + "%",
                            "z-index": 99,
                            "clip-path": `polygon(0 ${(yps - y) * 100 /height}%,0 ${(ypd - y) * 100 /height}%,100% ${(ycd - y) * 100 /height}%, 100% ${(ycs - y) * 100 /height}%)`
                        })
                    }
                }
                let placeInvertedBars = function () {
                    $scope.invBars = [];
                    $scope.shadedRegions = [];
                    let previousBar = undefined;
                    $scope.graphData.bars.forEach(bar => {
                        placeInvertedBar(bar);
                        placeShadedRegion(previousBar, bar);
                        previousBar = bar;
                    });
                }
                let placeLine = function (previousPoint, currentPoint) {
                    if (previousPoint) {
                        let xc = getXValue(getDateTime(currentPoint[1]));
                        let yc = (240 - currentPoint[0]) * 10 / rows;
                        let xp = getXValue(getDateTime(previousPoint[1]));
                        let yp = (240 - previousPoint[0]) * 10 / rows;
                        let y = Math.min(yp, yc);
                        let x = Math.min(xp, xc);
                        let thickness = 2;
                        let height = Math.max(yp, yc) - y + thickness;
                        let p1 = (yp - y) * 100 /height
                        let p2 = (yp - y) * 100 /height + thickness;
                        let p3 = (yc - y) * 100 /height + thickness;
                        let p4 = (yc - y) * 100 /height;
                        let width = xc - xp;
                        let color = "red"
                        $scope.anLines.push({
                            "line": {
                                "top": y + "%",
                                "left": x + "%",
                                "height": height + "%",
                                "width": width + '%',
                                "background-color": color,
                                "clip-path": `polygon(0 ${p1}%,0 ${p2}%,100% ${p3}%, 100% ${p4}%)`,
                                "z-index": 101
                            }
                        });
                    }
                }
                let placePoint = function (point) {
                    let x = getXValue(getDateTime(point[1]));
                    let y = (240 - point[0]) * 10 / rows
                    $scope.anPoints.push({
                        "style": {
                            "top": y + "%",
                            "left": x + "%",
                            "z-index": 101
                        }
                    });
                }
                let placePoints = function () {
                    let previousPoint = undefined;
                    $scope.anPoints = [];
                    $scope.anLines = [];
                    $scope.graphData.points.pulse.forEach(point => {
                        placePoint(point)
                        placeLine(previousPoint, point)
                        previousPoint = point
                    });
                }
                let fillCells = function () {
                    $scope.graphData.drugs.forEach(drug => {
                        let xOffset = Math.floor(Math.max(0, findMinutesFromChartStart(getDateTime(drug[2]))) / 10) + 1
                        let index = ((2 + drug[0]) * (cols)) + xOffset + 2;
                        if (index >= 0 && index < $scope.cells.length) {
                            $scope.cells[index].content = drug[1]
                        }
                    })
                    
                }
                let saveAnesthesia = function () {
                    let targetObs = $scope.observation.groupMembers[0];
                    targetObs.value = JSON.stringify($scope.graphData);
                    // Mirror every save to localStorage so the session survives
                    // navigating away without clicking the Bahmni Save button.
                    saveToLocalStorage();
                }

                $scope.completeSession = function () {
                    if (!$scope.graphData.startTime) {
                        $scope.resultMessage = {
                            valid: false,
                            message: "Cannot complete a session that has not been started.",
                            style: { "background-color": "rgba(255, 0, 0, 0.25)" }
                        };
                        return;
                    }
                    $scope.graphData.completed = true;
                    saveAnesthesia();
                    $scope.sessionCompleted = true;
                    $scope.resultMessage = {
                        valid: true,
                        message: "Session completed and saved.",
                        style: { "background-color": "rgba(0, 255, 0, 0.25)" }
                    };
                };

                $scope.startNewSession = function () {
                    if (!$scope.sessionCompleted && $scope.graphData && $scope.graphData.startTime) {
                        if (!$window.confirm("The current session has not been completed. Starting a new session will discard any unsaved changes to the active session. Are you sure?")) {
                            return;
                        }
                    }

                    // Null out UUIDs on the observation and all its group members.
                    // Bahmni treats observations without a UUID as brand-new records,
                    // causing a new timestamped entry to appear in the patient dashboard.
                    if ($scope.observation) {
                        $scope.observation.uuid = undefined;
                        if ($scope.observation.groupMembers) {
                            $scope.observation.groupMembers.forEach(function (gm) {
                                gm.uuid = undefined;
                                if (gm.groupMembers) {
                                    gm.groupMembers.forEach(function (sgm) {
                                        sgm.uuid = undefined;
                                    });
                                }
                            });
                        }
                    }

                    // Reset graphData to a clean blank session
                    $scope.graphData = {
                        "startTime": undefined,
                        "points": { "pulse": [] },
                        "drugs": [],
                        "bars": [],
                        "opt": [],
                        "ipt": [],
                        "anst": [],
                        "completed": false
                    };
                    if ($scope.roo) {
                        $scope.graphData.labels = getAnesthesiaLabels();
                    }

                    // Reset all time-tracking scope variables
                    $scope.anaesthesiaChartStartTime = undefined;
                    $scope.anaesthesiaStartTime = undefined;
                    $scope.anaesthesiaEndTime = undefined;
                    $scope.surgeryStartTime = undefined;
                    $scope.surgeryEndTime = undefined;
                    $scope.intubationStartTime = undefined;
                    $scope.intubationEndTime = undefined;
                    $scope.abStc = undefined;
                    $scope.abSt = undefined;
                    $scope.abEt = undefined;
                    $scope.surSt = undefined;
                    $scope.surEt = undefined;
                    $scope.intSt = undefined;
                    $scope.intEt = undefined;
                    $scope.sessionCompleted = false;

                    // Reset visual state
                    cols = 29;
                    $scope.cells = [];
                    $scope.ylabels = [];
                    $scope.invBars = [];
                    $scope.freeTokens = [];
                    $scope.shadedRegions = [];
                    $scope.anPoints = [];
                    $scope.anLines = [];

                    // Reset layout styles — plotAreaStyle.height is set to "200vh" by
                    // insertAnesthesiaLabels and must be cleared for the fresh session.
                    $scope.parentGraphStyle = {
                        width: '100%',
                        "min-width": 'max(50vw, 750px)'
                    };
                    $scope.plotAreaStyle = {};

                    // Clear localStorage so the next reload doesn't try to
                    // resume a session that no longer exists.
                    clearLocalStorage();

                    // Persist the blank session value so the form knows it changed
                    saveAnesthesia();
                    // rebuildAnesthesiaGridIfNeeded already calls insertAnesthesiaLabels
                    // internally — do NOT call insertAnesthesiaLabels again here or all
                    // cells/labels will be pushed twice.
                    rebuildAnesthesiaGridIfNeeded();
                    $scope.resultMessage = {
                        valid: true,
                        message: "New session started. Fill in the chart start time to begin.",
                        style: { "background-color": "rgba(0, 200, 100, 0.25)" }
                    };
                };
                let drawAnesthesia = function () {
                    rebuildAnesthesiaGridIfNeeded();
                    if (!$scope.roo && $scope.cells.length === 0) {
                        insertAnesthesiaLabels();
                    }
                    placePoints();
                    placeTokens();
                    placeInvertedBars();
                    fillCells();
                }
                $scope.setMedication = function (medication, medicationAmount) {
                    if(checkTimeValid() && medicationAmount && medication){
                        $scope.graphData.drugs.push([medication.value, medicationAmount,$scope.currentTime.value])
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setPulse = function (pulse){
                    if(checkTimeValid() && checkPulseValid(pulse)){
                        $scope.graphData.points.pulse.push([pulse, $scope.currentTime.value]);
                        $scope.graphData.points.pulse.sort(function (a, b) {
                            return getDateTime(a[1]) - getDateTime(b[1])
                        })
                        saveAnesthesia();
                        drawAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                if (!cols) {
                    for (let index = 0; index < rows * 24; index++) {
                        $scope.cells.push({
                            "style": {
                                "height": 100 / rows + '%'
                            }
                        });
                    }
                    for (let value = rowTerm; value >= rowInit; value = value - rowValue) {
                        $scope.ylabels.push({
                            "label": value,
                            "style": { "height": 100 / rows + '%' }
                        });
                    }
                }
                
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/graph.html'
        };
    }]);
