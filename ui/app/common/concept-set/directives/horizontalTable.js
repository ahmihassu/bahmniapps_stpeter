'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('horizontalTable', ['$window', '$http', '$document', function ($window, $http, $document) {
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
                $scope.tableData = [];
                $scope.accobs = $scope.observation.groupMembers.filter(x => x.concept.displayString !== "Graph Data");
                $scope.visualTable = [];
                for (let index = 0; index < 24; index++) {
                    $scope.visualTable.push(["", ""]);
                }
                if ($scope.roo) {
                    $scope.allLabels = $scope.accobs.map((obj) => obj.concept.displayString);
                    $scope.accobs.forEach(element => {
                        let tempRow = [];
                        for (let index = 0; index < 24; index++) {
                            let metaElement = {
                                value: "",
                                name: element.concept.displayString,
                                dataType: element.concept.dataType,
                                answers: element.concept.answers.map((obj) => obj.displayString),
                                hi: element.concept.hiAbsolute,
                                low: element.concept.lowAbsolute
                            };
                            tempRow.push(metaElement);
                        }
                        $scope.tableData.push(tempRow);
                    });
                } else {
                    let parsedText = JSON.parse($scope.observation.groupMembers[0].value);
                    $scope.allLabels = parsedText.labels;
                    parsedText.values.forEach((element, i) => {
                        for (let index = 0; index < 24; index++) {
                            if ($scope.visualTable[index]) {
                                $scope.visualTable[index][i+1] = element[index];
                            }
                        }
                    });
                }

                $scope.handleUpdate = function () {
                    let targetObs = $scope.observation.groupMembers.filter(x => x.concept.displayString === "Graph Data")[0];
                    let answers = {values: [], labels: $scope.allLabels};
                    $scope.tableData.forEach(row => {
                        answers.values.push(row.map((obj) => obj.value));
                    });
                    targetObs.value = JSON.stringify(answers);
                };

                var fetchData = function (patientUuid, formGroup, customRepresentation) {
                    var params = {
                        patient: patientUuid,
                        limit: 1,
                        numberOfVisits: 1,
                        v: customRepresentation,
                        conceptNames: formGroup
                    };
                    return $http.get(Bahmni.Common.Constants.openmrsObsUrl, {params: params});
                };

                var generateTimeLabels = function () {
                    let timeLabels = [];
                    let startTime = $scope.startTimeFixed || getDateTime($scope.roo.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                    let currStrTime = ""
                    for (let index = 0; index < 24; index++) {
                        currStrTime = moment(startTime).format("hh:mm");
                        timeLabels.push(currStrTime);
                        startTime.setMinutes(startTime.getMinutes() + 30);
                        $scope.visualTable[index][0] = currStrTime;
                    }
                    return timeLabels;
                };

                fetchData($scope.patient.uuid, ["Partograph Start Time"], "custom:(value)").then(res => {
                    if (res.data.results.length) {
                        $scope.startTimeFixed = new Date(res.data.results[0].value.split("+")[0]);
                        $scope.timeLabels = generateTimeLabels();
                    }
                });

                fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(groupMembers)").then(res => {
                    if (!$scope.roo) {
                    }
                    else if ($scope.observation.groupMembers[0].value) {
                        let answers = JSON.parse($scope.observation.groupMembers[0].value);
                        answers.values.forEach((row, rowIndex) => {
                            row.forEach((cell, cellIndex) => {
                                $scope.tableData[rowIndex][cellIndex].value = cell;
                            });
                        });
                    }
                    else if (res.data.results.length) {
                        let answers = JSON.parse(res.data.results[0].groupMembers.filter(x => x.concept.display === "Graph Data")[0].value);
                        if (answers.values) {
                            answers.values.forEach((row, rowIndex) => {
                                row.forEach((cell, cellIndex) => {
                                    $scope.tableData[rowIndex][cellIndex].value = cell;
                                });
                            });
                        }
                        let targetObs = $scope.observation.groupMembers.filter(x => x.concept.displayString === "Graph Data")[0];
                        targetObs.value = JSON.stringify(answers);
                    }
                });
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/horizontalTable.html'
        };
    }]);
