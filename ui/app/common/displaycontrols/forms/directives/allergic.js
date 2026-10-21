'use strict';


angular.module('bahmni.common.displaycontrol.forms')
    .directive('allergic', ['appService', '$http', 'conceptSetService', '$rootScope',
        'spinner', '$q','clinicalDashboardConfig','observationsService', '$stateParams','$state', 'visitFormService', 
        function (appService, $http, conceptSetService, $rootScope,
            spinner,$q, observationsService, $state, $stateParams, visitFormService,clinicalDashboardConfig)

 {
            return {
                restrict: 'E',
                scope: {
                    observation: '=',
                rootObs: '=',
                patient: '=',
                fixed: '=?'
                    
                },
                templateUrl: "../common/displaycontrols/forms/views/allergic.html",
                controller: function ($scope) {
                    $scope.medications = [];
                    $scope.foods = [];
                    $scope.others = [];
                    $scope.hasAllergies = false;

                    function shouldExclude(value) {
                        if (!value) return true;
                        
                        var lowerValue = value.toLowerCase().trim();
                        
                        var excludePatterns = [
                            'none',
                            'no ',
                            'no allergy',
                            'none allergy',
                            'no known allergies',
                            'no allergies',
                            'none known',
                                 
                        ];
                        
                        for (var i = 0; i < excludePatterns.length; i++) {
                            if (lowerValue === excludePatterns[i] || 
                                lowerValue.includes(excludePatterns[i])) {
                                return true;
                            }
                        }
                        
                        if (lowerValue.match(/^(none|no)\s*$/)) {
                            return true;
                        }
                        
                        return false;
                    }

                    $scope.$watch('patient', function (newVal) {
                        if (newVal && newVal.uuid) {
                            $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                                params: {
                                    q: "bahmni.sqlGet.allergyNotification",
                                    id: $scope.patient.uuid
                                }
                            }).then(function (response) {
                               // console.log("ACTUAL DATA FROM DATABASE:", response.data);

                                $scope.medications = [];
                                $scope.foods = [];
                                $scope.others = [];
                                if (response.data && response.data.length > 0) {
                                    angular.forEach(response.data, function (item) {
                                        var value = item.value_text;
                                        
                                        if (shouldExclude(value)) {
                                            //console.log("Excluded:", value);
                                            return; 
                                        }

                                        if (item.category_name === 'Medication Notes') {
                                            $scope.medications.push(value);
                                        } else if (item.category_name === 'Food Notes') {
                                            $scope.foods.push(value);
                                        } else {
                                            $scope.others.push(value);
                                        }
                                    });
                                }
                                $scope.hasAllergies = ($scope.medications.length > 0 ||
                                    $scope.foods.length > 0 ||
                                    $scope.others.length > 0);
                            });
                        }
                    });
                }
            };
        }]);