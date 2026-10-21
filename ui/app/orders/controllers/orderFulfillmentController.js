"use strict";

angular.module('bahmni.orders').controller('OrderFulfillmentController', ['$scope', '$rootScope', '$stateParams', '$filter', '$state', '$q','$http', '$window', 'patientContext', 'orderService', 'orderObservationService',
    'orderTypeService', 'sessionService', 'encounterService', 'spinner', 'messagingService', 'appService', '$anchorScroll', 'orderFulfillmentConfig', 'contextChangeHandler', '$translate', 'paymentStatusService',
    function ($scope, $rootScope, $stateParams, $filter, $state, $q, $http, $window, patientContext, orderService, orderObservationService,
              orderTypeService, sessionService, encounterService, spinner, messagingService, appService, $anchorScroll, orderFulfillmentConfig, contextChangeHandler, $translate, paymentStatusService) {
        $scope.patient = patientContext.patient;
        var payment_config = appService.getAppDescriptor().getConfigValue("paymentConfig")
        $scope.fulfillmentForm = $stateParams.orderType + Bahmni.Common.Constants.fulfillmentFormSuffix;
        $scope.fulfillmentConfig = orderFulfillmentConfig;
        $scope.orderType = $stateParams.orderType;
        $scope.nextPageLoading = false;
        $scope.orderUuid = $stateParams.orderUuid;
        $scope.dashboardConfig = appService.getAppDescriptor().getConfigValue('dashboard');
        $scope.orders = [];
        $scope.procedureForm = Bahmni.Common.Constants.procedureDoneForm

        var getActiveEncounter = function () {
            var currentProviderUuid = $rootScope.currentProvider ? $rootScope.currentProvider.uuid : null;
            return encounterService.find({
                patientUuid: $scope.patient.uuid,
                providerUuids: !_.isEmpty(currentProviderUuid) ? [currentProviderUuid] : null,
                includeAll: Bahmni.Common.Constants.includeAllObservations,
                locationUuid: sessionService.getLoginLocationUuid()
            }).then(function (encounterTransactionResponse) {
                $scope.encounter = encounterTransactionResponse.data;
                return $scope.encounter;
            });
        };

        $scope.getOrders = function () {
            var patientUuid = patientContext.patient.uuid;
            $scope.orderTypeUuid = orderTypeService.getOrderTypeUuid($stateParams.orderType);
            var includeObs = false;
            var params = {
                patientUuid: patientUuid,
                orderTypeUuid: $scope.orderTypeUuid,
                conceptNames: $scope.config.conceptNames,
                includeObs: includeObs,
                numberOfVisits: $scope.config.numberOfVisits,
                obsIgnoreList: $scope.config.obsIgnoreList,
                visitUuid: $scope.visitUuid,
                orderUuid: $scope.orderUuid,
                locationUuids: $rootScope.facilityLocationUuids
            };
            return orderService.getOrders(params).then(function (response) {
                $scope.dashboard = Bahmni.Common.DisplayControl.Dashboard.create($scope.dashboardConfig || {}, $filter);
                $scope.sectionGroups = $scope.dashboard.getSections($scope.diseaseTemplates);
                var data = response.data;
                $scope.orders.push.apply($scope.orders, data);
                $scope.orders.forEach(function (order) {
                    order.bahmniObservations = _.filter($scope.encounter.observations, function (observation) {
                        return observation.orderUuid === order.orderUuid;
                    });
                    if (order.bahmniObservations.length > 0) {
                        order.showForm = true;
                    }
                    getOrderPaymentStatus(order); 
                    getStudyLink(order);    
                });
            });
        };


        $scope.isUserPrivilegedForFulfillment = function () {
                var orderFulFillmentPrivilege = Bahmni.Common.Constants.orderFulFillmentPrivilege;
                var hasPrivilege = _.filter($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name === orderFulFillmentPrivilege;
                });
                return hasPrivilege.length > 0;
            };

        var getOrderPaymentStatus = function (order) {
            if(!payment_config["disable checking"]){
                paymentStatusService.getPaymentStatus(order.concept.name, order.orderUuid).then(function (response) {
                   order.paymentStatus = response.data; 
                });
            }
            else{
                order.paymentStatus = true
            }
        };

        var getStudyLink = function (order) {
            queryPacsStudies().then(function (response) {
                if (response.data.length > 0) {
                    order.studyUID = _.filter(response.data, function(study){
                        return order.orderNumber == study.accessionNumber
                    })[0].studyInstanceUID;
                }
            });
        };
        var queryPacsStudies = function () {
            var params = {
                patientId: $scope.patient.identifier
            };
            return $http.get('/openmrs/ws/rest/v1/pacs/studies', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        $scope.openImage = function (studyUID) {
            var url = "/oviyam2/viewer.html?patientID={{patientID}}&studyUID={{studyUID}}"
            .replace("{{patientID}}",$scope.patient.identifier )
            .replace("{{studyUID}}", studyUID );
            if (url == undefined) {
                messagingService.showMessage("info", "No study available yet for this order ");
                return;
            }
            spinner.forAjaxPromise($.ajax({type: 'HEAD', url: url, async: false}).then(
                function () {
                    $window.open(url, "_blank");
                }, function () {
                messagingService.showMessage("info", "No image available yet for this order ");
            }));
        };

        $scope.toggleShowOrderForm = function (order) {
            order.showForm = !order.showForm;
        };

        var init = function () {
            return getActiveEncounter().then($scope.getOrders);
        };

        spinner.forPromise(init());
        $scope.config = $scope.fulfillmentConfig || {};
        $anchorScroll();

        $scope.isFormValid = function () {
            var contxChange = contextChangeHandler.execute();
            var shouldAllow = contxChange["allow"];
            if (!shouldAllow) {
                var errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : "{{'ORDERS_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                messagingService.showMessage('error', errorMessage);
            }
            return shouldAllow;
        };

        $scope.getEmptyMessage = function () {
            return $translate.instant('NO_ORDERS_PRESENT', {orderType: $scope.orderType});
        };

        $scope.$on("event:saveOrderObservations", function () {
            if (!$scope.isFormValid()) {
                $scope.$parent.$broadcast("event:errorsOnForm");
                return $q.when({});
            }
            var savePromise = orderObservationService.save($scope.orders, $scope.patient, sessionService.getLoginLocationUuid());
            spinner.forPromise(savePromise.then(function () {
                $state.transitionTo($state.current, $state.params, {
                    reload: true,
                    inherit: false,
                    notify: true
                }).then(function () {
                    messagingService.showMessage('info', 'Saved');
                });
            }).catch(function (error) {
                var message = $translate.instant("DEFAULT_SERVER_ERROR_MESSAGE");
                try {
                /* This is a dirty fix to do, the real reason of failure is because of there is no visit type assosiated with
                 save request to create a new visit in mrs.
                  */
                    if (error.data.error.message.indexOf("Visit Type is required") >= 0) {
                        message = $translate.instant("VISIT_CLOSED_CREATE_NEW_ERROR_MESSAGE");
                    }
                } catch (e) { /* ignore the error */ }
                messagingService.showMessage('error', message);
            }));
        });
    }]);
