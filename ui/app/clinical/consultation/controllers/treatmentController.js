'use strict';

angular.module('bahmni.clinical')
    .controller('TreatmentController', ['$scope', 'clinicalAppConfigService', 'treatmentConfig', '$stateParams','visitFormService', '$location', '$window',
        function ($scope, clinicalAppConfigService, treatmentConfig, $stateParams, visitFormService, $location, $window) {
           /*  var currentUrl = $location.$$absUrl.replace("https","http");
            $window.location.href = currentUrl */
            var init = function () {
                var drugOrderHistoryConfig = treatmentConfig.drugOrderHistoryConfig || {};
                $scope.drugOrderHistoryView = drugOrderHistoryConfig.view || 'default';
                $scope.tabConfigName = $stateParams.tabConfigName || 'default';


                visitFormService.formData($scope.patient.uuid, 10, ["ER General Notes, Allergies"]).then(
                    x => $scope.allergies = x.data.results
                )
                var initializeTreatments = function () {
                    $scope.consultation.newlyAddedTabTreatments = $scope.consultation.newlyAddedTabTreatments || {};
                    $scope.consultation.newlyAddedTabTreatments[$scope.tabConfigName] = $scope.consultation.newlyAddedTabTreatments[$scope.tabConfigName] || {treatments: [], orderSetTreatments: [], newOrderSet: {}};
                    $scope.treatments = $scope.consultation.newlyAddedTabTreatments[$scope.tabConfigName].treatments;
                    $scope.orderSetTreatments = $scope.consultation.newlyAddedTabTreatments[$scope.tabConfigName].orderSetTreatments;
                    $scope.newOrderSet = $scope.consultation.newlyAddedTabTreatments[$scope.tabConfigName].newOrderSet;
                };

                $scope.$watch('consultation.newlyAddedTabTreatments', initializeTreatments);

                $scope.enrollment = $stateParams.enrollment;
                $scope.treatmentConfig = treatmentConfig;
            };
            init();
        }]);
