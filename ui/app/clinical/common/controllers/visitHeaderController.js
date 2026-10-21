'use strict';

angular.module('bahmni.clinical')
    .controller('VisitHeaderController', ['$http','$rootScope', '$scope' ,'$state', 'clinicalAppConfigService', 'patientContext', 'visitHistory', 'visitConfig', 'contextChangeHandler', '$location', '$stateParams', 'urlHelper', 'paymentStatusService', 'appService',
        function ($http,$rootScope, $scope, $state, clinicalAppConfigService, patientContext, visitHistory, visitConfig, contextChangeHandler, $location, $stateParams, urlHelper, paymentStatusService, appService) {
            $scope.patient = patientContext.patient;
            $scope.visitHistory = visitHistory;
            $scope.consultationBoardLink = clinicalAppConfigService.getConsultationBoardLink();
            $scope.showControlPanel = false;
            $scope.visitTabConfig = visitConfig;
            var payment_config = appService.getAppDescriptor().getConfigValue("paymentConfig")
            $scope.switchTab = function (tab) {
                $scope.visitTabConfig.switchTab(tab);
                $rootScope.$broadcast('event:clearVisitBoard', tab);
            };

            $scope.gotoPatientDashboard = function () {
                if (contextChangeHandler.execute()["allow"]) {
                    $location.path($stateParams.configName + "/patient/" + patientContext.patient.uuid + "/dashboard");
                }
            };

            var getOrderUuid = function () {
                var params = {
                    q: "bahmni.sqlGet.orderUuid",
                    id: $scope.patient.identifier
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            
            $scope.patient.paymentStatus = false;

            $scope.paymentStatus = function(){
                if(!payment_config["disable checking"]){
                    getOrderUuid().then(resp => resp.data[0] ? paymentStatusService.getPaymentStatus(resp.data[0].uuid).then(function (response) {
                        $scope.patient.paymentStatus = response.data;
                    }): $scope.patient.paymentStatus = false)
                }
                else{
                    $scope.patient.paymentStatus = false; 
                }
            }
            $scope.paymentStatus()

            $scope.openConsultation = function () {
                var board = clinicalAppConfigService.getAllConsultationBoards()[0];
                var urlPrefix = urlHelper.getPatientUrl();
                $scope.collapseControlPanel();
                $rootScope.hasVisitedConsultation = true;
                var url = "/" + $stateParams.configName + (board.url ? urlPrefix + "/" + board.url : urlPrefix);
                var extensionParams = board.extensionParams;
                var queryParams = [];
                if ($stateParams.programUuid) {
                    var programParams = {
                        "programUuid": $stateParams.programUuid,
                        "enrollment": $stateParams.enrollment
                    };
                    extensionParams = _.merge(programParams, extensionParams);
                }
                angular.forEach(extensionParams, function (extensionParamValue, extensionParamKey) {
                    queryParams.push(extensionParamKey + "=" + extensionParamValue);
                });
                if (!_.isEmpty(queryParams)) {
                    url = url + "?" + queryParams.join("&");
                }

                $location.url(url);
            };

            $scope.closeTab = function (tab) {
                $scope.visitTabConfig.closeTab(tab);
                $rootScope.$broadcast("event:clearVisitBoard", tab);
            };

            $scope.print = function () {
                $rootScope.$broadcast("event:printVisitTab", $scope.visitTabConfig.currentTab);
            };

            $scope.showPrint = function () {
                return $scope.visitTabConfig.showPrint();
            };
        }]);
