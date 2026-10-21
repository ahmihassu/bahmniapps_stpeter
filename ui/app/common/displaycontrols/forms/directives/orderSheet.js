'use strict';

angular.module('bahmni.common.displaycontrol.forms')
    .directive('orderSheet', ['appService', '$http', 'conceptSetService', '$rootScope', 'spinner', 'observationsService', '$stateParams', 'visitFormService',
        function (appService, $http, conceptSetService, $rootScope, spinner, observationsService, $stateParams, visitFormService) {
            return {
                restrict: 'E',
                scope: {
                    observation: '=',
                    rootObs: '=',
                    patient: '=',
                    fixed: '=?'
                },
                link: function (scope, element, attrs) {
                    if (attrs.dirtyCheckFlag) {
                        scope.hasDirtyFlag = true;
                    }
                },
                controller: function ($scope) {

                    var getOrderSheet = function () {
                        var params = {
                            q: "bahmni.sqlGet.orderSheetForm",
                            id: $scope.patient.uuid
                        };
                        return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                            method: "GET",
                            params: params,
                            withCredentials: true
                        });
                    };

                  getOrderSheet().then(function (response) {
                        function groupByFullTimestamp(data) {
                            return data.reduce((acc, item) => {
                                const dt = item.form_filled_at;
                                const timestampKey = dt[0] + '-' + dt[1] + '-' + dt[2] + ' ' + dt[3] + ':' + dt[4] + ':' + dt[5];
                                if (!acc[timestampKey]) {
                                    acc[timestampKey] = [];
                                }
                                acc[timestampKey].push(item);
                                return acc;
                            }, {});
                        }

                        // Format timestamp string from "YYYY-M-D H:m:s" to "M/D/YYYY h:mm:ss AM/PM"
                         function formatTimestamp(originalTimestamp) {
                            const [datePart, timePart] = originalTimestamp.split(' ');
                            const [year, month, day] = datePart.split('-').map(Number);
                            const [hour, minute, second] = timePart.split(':').map(Number);

                            // Create local Date assuming originalTimestamp is local time
                            const localDate = new Date(year, month - 1, day, hour, minute, second);

                            // Subtract 3 hours (in milliseconds) to make it local
                            const adjustedDate = new Date(localDate.getTime() + 3 * 60 * 60 * 1000);

                            return adjustedDate.toLocaleString('en-US', {
                                year: 'numeric', month: 'numeric', day: 'numeric',
                                hour: 'numeric', minute: 'numeric', second: 'numeric',
                                hour12: true
                            }).replace(',', '');
                        }

                        $scope.data = groupByFullTimestamp(response.data);

                        // Sort timestamps chronologically
                        $scope.timestampKeys = Object.keys($scope.data).sort((a, b) => new Date(a) - new Date(b));

                        // Map original timestamps to formatted strings for UI display
                        $scope.formattedDates = {};
                        $scope.timestampKeys.forEach(tsKey => {
                            $scope.formattedDates[tsKey] = formatTimestamp(tsKey);
                        });

                        // Extract unique concept names
                        let conceptsSet = new Set();
                        Object.values($scope.data).forEach(itemsArray => {
                            itemsArray.forEach(item => conceptsSet.add(item.concept_name));
                        });
                        $scope.concepts = Array.from(conceptsSet).sort();
                    })
                    .catch(function (error) {
                        console.error("Error fetching order sheet form data:", error);
                    });
                },

                templateUrl: "../common/displaycontrols/forms/views/orderSheet.html",
            }
        }
    ]);
