'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('contractionTable', ['$window', '$http', '$document', function ($window, $http, $document) {
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
                $scope.squares = [];
                $scope.observation.hideTitle = true;
                let textures = ["blank", "dotted", "striped", "solid"];

                let initSquares = function () {
                    for (let index = 0; index < 120; index++) {
                        $scope.squares.push({
                            value: "blank",
                            index: index
                        });
                    }
                };
                $scope.cycle = function (cell, value) {
                    if ($scope.roo) {
                        let curr = textures.indexOf(cell.value);
                        if (!value) {
                            if (curr < 3) {
                                cell.value = textures[curr + 1];
                            }
                            else {
                                cell.value = textures[0];
                            }
                            cell.clicked = true;
                            let tracker = cell.index + 24;
                            if (tracker < 120) $scope.cycle($scope.squares[tracker], cell.value);
                            $scope.observation.value = JSON.stringify($scope.squares);
                        }
                        else if (!cell.clicked) {
                            cell.value = value;
                            let tracker = cell.index + 24;
                            if (tracker < 120) $scope.cycle($scope.squares[tracker], cell.value);
                            $scope.observation.value = JSON.stringify($scope.squares);
                        }
                        else {
                            return;
                        }
                    }
                };

                initSquares();

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
                    for (let index = 0; index < 24; index++) {
                        timeLabels.push(moment(startTime).format("hh:mm"));
                        startTime.setMinutes(startTime.getMinutes() + 30);
                    }
                    return timeLabels;
                };

                fetchData($scope.patient.uuid, ["Partograph Start Time"], "custom:(value)").then(res => {
                    if (res.data.results.length) {
                        $scope.startTimeFixed = new Date(res.data.results[0].value.split("+")[0]);
                        $scope.timeLabels = generateTimeLabels();
                    }
                });

                fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(value)").then(res => {
                    if (res.data.results.length) {
                        $scope.squares = JSON.parse(res.data.results[0].value);
                        $scope.observation.value = JSON.stringify($scope.squares);
                    }
                });
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/contractionTable.html'
        };
    }]);
