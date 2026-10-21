"use strict";

var Bahmni = Bahmni || {};
Bahmni.Graph = Bahmni.Graph || {};

Bahmni.Graph.c3Chart = function () {
    var dateUtil = Bahmni.Common.Util.DateUtil;

    var createReferenceClasses = function (data) {
        var classes = {};
        _.each(data, function (datum) {
            if (datum.reference) {
                classes[datum.name] = 'reference-line';
            }
        });
        return classes;
    };

    var formatValueForDisplay = function (value, config) {
        if (config.displayForAge()) {
            return Bahmni.Common.Util.AgeUtil.monthsToAgeString(value);
        } else if (config.displayForObservationDateTime()) {
            return dateUtil.formatDateWithoutTime(value);
        } else {
            return d3.round(value, 2);
        }
    };

    var createXAxisConfig = function (config) {
        var tickConfig = {
            format: function (xAxisValue) {
                return formatValueForDisplay(xAxisValue, config);
            }
        };
        if (config.displayForAge()) {
            tickConfig.culling = false;
            tickConfig.count = 12;
            if (config.ageAxisTickValues && config.ageAxisTickValues.length) {
                tickConfig.values = config.ageAxisTickValues;
            }
        } else {
            tickConfig.culling = {
                max: 3
            };
            tickConfig.count = 10;
        }
        return {
            label: {
                text: config.xAxisConcept + (config.unit || ''),
                position: 'outer-right'
            },
            type: config.type,
            tick: tickConfig
        };
    };

    var createYAxisConfig = function (unit) {
        return {
            label: {
                text: unit,
                position: 'outer-top'
            },
            tick: {
                culling: {
                    max: 3
                },
                format: function (y) {
                    return d3.round(y, 2);
                }
            },
            show: true
        };
    };

    var createAxisConfig = function (config, units) {
        var axis = {
            x: createXAxisConfig(config),
            y: createYAxisConfig(units[0])
        };
        if (units[1] !== undefined) {
            axis['y2'] = createYAxisConfig(units[1]);
        }
        return axis;
    };

    var createGridConfig = function (config) {
        var grid = {
            y: {
                lines: []
            }
        };
        if (config.yAxisConcepts.length === 1) {
            if (config.lowNormal !== undefined) {
                grid.y.lines.push({value: config.lowNormal, text: "low", class: "lowNormal"});
            }
            if (config.hiNormal !== undefined) {
                grid.y.lines.push({value: config.hiNormal, text: "high", class: "hiNormal"});
            }
        }
        return grid;
    };

    var createConfigForToolTipGroupingFix = function (config) {
        var xs = {};
        config.yAxisConcepts.forEach(function (yAxisConcept) {
            xs[yAxisConcept] = config.xAxisConcept;
        });
        return xs;
    };

    var createAxisAndPopulateAxes = function (axes, data, axisY, unit) {
        if (!unit) { return; }
        _.each(data, function (item) {
            if (item.units === unit) {
                axes[item.name] = axisY;
            }
        });
    };
    var createConfigForAxes = function (data, units) {
        var axes = {};
        createAxisAndPopulateAxes(axes, data, 'y', units[0]);
        createAxisAndPopulateAxes(axes, data, 'y2', units[1]);
        return axes;
    };

    this.fhbHeartbeat = function (bindTo, graph_values) {
        var abs_top = ["Ceiling"]
        var high = ["Danger High"]
        var low = ["Danger low"]
        var abs_floor = ["Floor"]
        var x = ["x"]
        var fhb = ["Fetal Heart Beat"]
        graph_values.forEach(function (graph_value) {
            abs_top.push(200)
            high.push(180)
            low.push(100)
            abs_floor.push(80)
            x.push(minutestoTime(graph_value.time))
            fhb.push(graph_value.value)
        })

        for (var i = 0; i < 24; i++) {
            abs_top.push(200)
            high.push(180)
            low.push(100)
            abs_floor.push(80)
            x.push(minutestoTime(i * 30))
        }


        var c3Config = {
            bindto: bindTo,
            data: {
                x: 'x',
                xFormat: '%H:%M',
                columns: [
                    x,
                    abs_top,
                    high,
                    low,
                    abs_floor,
                    fhb
                ],
                colors: {
                    'Danger High': '#ff0000',
                    'Danger low': '#ff0000',
                    Ceiling: '#000000',
                    Floor: '#000000'
                }
            },
            grid: {
                x: {
                    show: true
                },
                y: {
                    show: true
                }
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%H:%M'
                   }
                }
             }
        }

        var c3Chart = c3.generate(c3Config);

    }

    this.weightChart = function (bindTo,high,low,values){
        var col = ['Weight']
        var x = ['x']
        values.forEach(function(value){
            col.push(value)
        })
        for (let i=0;i<21;i++)
         x.push(i)
        var chartConfig = {
            bindto: bindTo,
            data: {
                x: 'x',
                columns:[
                    x,
                    col
                ]
            },
            grid: {
                x: {
                    show: true
                },
                y: {
                    show: true
                }
            },
            axis: {
                y: {
                    max: high,
                    min: low,
                }
            }
        } 
        var c3Chart = c3.generate(chartConfig)
    }


    this.triple = function (bindTo, graph_values) {
        var x = ['x']
        var abs_top = ["Ceiling"]
        var abs_floor = ["Floor"]
        var x2 = ['x2']
        var pulse = ['Pulse']
        var x3 = ['x3']
        var bps = ['Systolic']
        var bpd = ['Diastolic']

        for (var i = 0; i < 24; i++) {
            abs_top.push(180)
            abs_floor.push(60)
            x.push(i)
        }
        graph_values.forEach(function (graph_value) {
            if (graph_value.name.includes('Pulse')) {
                x2.push(graph_value.time)
                pulse.push(graph_value.value.split(': ').slice(-1))
            }
            else if (graph_value.name.includes('Systolic')) {
                x3.push(graph_value.time)
                bps.push(graph_value.value)
            }
            else if (graph_value.name.includes('Diastolic')) {
                bpd.push(graph_value.value)
            }
        })
        var temp = bps 
        bps.forEach(function(sys, ind){
            if(ind>0)temp[ind] = bps[ind] - bpd[ind]
        })
        bps = temp

        var c3Config = {
            bindto: bindTo,
            data: {
                xs: {
                    'Ceiling': 'x',
                    'Floor': 'x',
                    'Pulse': 'x2',
                    'Systolic': 'x3',
                    'Diastolic': 'x3'
                },
                columns: [
                    x,
                    x2,
                    x3,
                    abs_top,
                    abs_floor,
                    pulse,
                    bpd,
                    bps
                ],
                regions: {
                    'Ceiling': [{'end':23}], // currently 'dashed' style only
                    'Floor': [{'end':23}],
                    'Pulse': [{'end':23}]
                },
                colors: {
                    Diastolic: '#ffffff',
                    Systolic: '#000000',
                    Ceiling: '#000000',
                    Floor: '#000000',
                    Pulse: '#ff0000'
                },
                type: 'bar',
                types: {
                    Pulse: 'line',
                    Systolic: 'bar',
                    Diastolic: 'bar',
                    Ceiling: 'line',
                    Floor: 'line'

                },
                groups: [
                    ['Systolic','Diastolic']
                ],
                order: null
            },
            legend: {
                show: false
            },

            bar: {
                width: 2
            },

            grid: {
                x: {
                    show: true
                },
                y: {
                    show: true
                }
            }
        }

        var c3Chart = c3.generate(c3Config);

    }

        var minutestoTime = function(min){
        var temp_head = ""
        if(min%60 == 0) temp_head = Math.floor(min/60) + ":00"
        else temp_head = Math.floor(min/60) + ":30"
        return temp_head 
    }

    this.cdGraph = function (bindTo, graph_values) {
        var x3 = ["x3"]
        var cd = ["Cervical Dilatation"]
        var doh = ["Descent of head"]

        graph_values.forEach(function (graph_value) {
            if(graph_value.name.includes("Cervical Dilatation")){
                x3.push(minutestoTime(graph_value.time))
                cd.push(graph_value.value)
            }
            else{
                x3.push(minutestoTime(graph_value.time))
                doh.push(graph_value.value)
            }
            
        })
        var c3Config = {
            bindto: bindTo,
            data: {
                xs: {
                    'Alert': 'x1',
                    'Action': 'x2',
                    'Cervical Dilatation': 'x3',
                    'Descent of head': 'x3'
                },
                xFormat: '%H:%M',
                columns: [
                    ['x1', '0:00', '6:00'],
                    ['x2', '4:00', '10:00'],
                    ['Alert', 4, 10],
                    ['Action', 4, 10],
                    x3,
                    cd,
                    doh
                ],
                colors: {
                    Alert: '#d1580a',
                    Action: '#ff0000',
                    'Descent of head': '#51f542'

                }
            },
            grid: {
                x: {
                    show: true
                },
                y: {
                    show: true
                }
            },
            axis: {
                x: {
                    type: 'timeseries',
                    tick: {
                        format: '%H:%M'
                    }
                }
            }
        }

        var c3Chart = c3.generate(c3Config);

        return c3Chart;
    }

    this.exapleRender = function (bindTo) {
        var c3Config = {
            bindto: bindTo,
            data: {
                xs: {
                    'Alert': 'x1',
                    'Action': 'x2'
                },
                columns: [
                    ['x1', 0, 6],
                    ['x2', 4, 10],
                    ['Alert', 4, 10],
                    ['Action', 4, 10]
                ]
            },
            grid: {
                x: {
                    show: true
                },
                y: {
                    show: true
                }
            }
        }

        var c3Chart = c3.generate(c3Config);

        return c3Chart;
    }
    
    this.render = function (bindTo, graphWidth, config, data) {
        var distinctUnits = _.uniq(_.map(data, 'units'));
        if (distinctUnits.length > 2) {
            throw new Error("Cannot display line graphs with concepts that have more than 2 units");
        }

        var allPoints = _(data).reduce(function (accumulator, item) {
            return accumulator.concat(item.values);
        }, []);
        if (config.displayForAge() && config.xAxisConcept) {
            var ageValues = _(allPoints).map(function (point) {
                return point[config.xAxisConcept];
            }).filter(function (value) {
                return value !== undefined && value !== null && !isNaN(Number(value));
            }).map(Number).value();
            if (ageValues.length) {
                var minAge = Math.max(0, Math.floor(_.min(ageValues)));
                var maxAge = Math.ceil(_.max(ageValues)) + 1;
                var span = maxAge - minAge;
                var targetTickCount = 12;
                var step = span <= targetTickCount ? 1 : Math.ceil(span / targetTickCount);
                var explicitTickValues = [];
                for (var tickValue = minAge; tickValue <= maxAge; tickValue += step) {
                    explicitTickValues.push(tickValue);
                }
                if (explicitTickValues.length && explicitTickValues[explicitTickValues.length - 1] < maxAge) {
                    explicitTickValues.push(maxAge);
                }
                config.ageAxisTickValues = explicitTickValues;
            }
        }

        var c3Chart;
        var c3Config = {
            bindto: bindTo,
            size: {
                width: graphWidth
            },
            padding: {
                top: 20,
                right: 50
            },
            data: {
                json: allPoints,
                keys: {
                    x: config.xAxisConcept,
                    value: config.yAxisConcepts
                },
                axes: createConfigForAxes(data, distinctUnits),
                xs: createConfigForToolTipGroupingFix(config),
                onclick: function (d) {
                    c3Chart.tooltip.show({data: d});
                },
                classes: createReferenceClasses(data)
            },
            point: {
                show: true,
                r: 5,
                sensitivity: 20
            },
            line: {
                connectNull: true
            },
            axis: createAxisConfig(config, distinctUnits),
            tooltip: {
                grouped: true,
                format: {
                    title: function (xAxisValue) {
                        return formatValueForDisplay(xAxisValue, config);
                    }
                }
            },
            zoom: {
                enabled: true
            },
            transition_duration: 0,
            grid: createGridConfig(config)
        };
        c3Chart = c3.generate(c3Config);
        delete config.ageAxisTickValues;
        return c3Chart;
    };
};

Bahmni.Graph.c3Chart.create = function () {
    return new Bahmni.Graph.c3Chart(); // eslint-disable-line new-cap
};
