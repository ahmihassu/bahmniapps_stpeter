'use strict';

angular.module('bahmni.clinical')
    .controller('SpecialOrdersDashboardController', ['$scope','clinicalDashboardConfig',
        '$state', 'visitSummary', 'appService', '$stateParams', 'diseaseTemplateService', 'patientContext', '$filter',
        function ($scope, clinicalDashboardConfig,
                  $state, visitSummary, appService, $stateParams, diseaseTemplateService, patientContext,$filter) {
         $scope.patient = patientContext.patient;
            $scope.activeVisit = $scope.visitHistory.activeVisit;
            $scope.activeVisitData = {};
            $scope.visitSummary = visitSummary;

            var createDashboard = function () {
                var dashboardConfig = appService.getAppDescriptor().getConfigValue('specialOrderDashboard');
                return dashboardConfig || {};
            };

            $scope.init = function (dashboard) {
                dashboard.startDate = null;
                dashboard.endDate = null;
            
                $state.current.dashboard = dashboard;
                var dashboardModel = Bahmni.Common.DisplayControl.Dashboard.create(dashboard, $filter);
                diseaseTemplateService.getLatestDiseaseTemplates(
                    $stateParams.patientUuid, clinicalDashboardConfig.getDiseaseTemplateSections(), dashboard.startDate, dashboard.endDate).then(function (diseaseTemplate) {
                        $scope.diseaseTemplates = diseaseTemplate;
                        $scope.sectionGroups = dashboardModel.getSections($scope.diseaseTemplates);
                    });
                $scope.currentDashboardTemplateUrl = $state.current.views['dashboard-content'] ?
                    $state.current.views['dashboard-content'].templateUrl : $state.current.views['dashboard-content'];
            };

            $scope.init(createDashboard());
        }]);
