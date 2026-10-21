'use strict';

angular.module('bahmni.clinical').controller('ConsultationController',
    ['$http','$scope', '$rootScope', '$state', '$location', '$translate', 'clinicalAppConfigService', 'diagnosisService', 'urlHelper', 'contextChangeHandler',
        'spinner', 'encounterService', 'messagingService', 'sessionService', 'retrospectiveEntryService', 'patientContext', '$q',
        'patientVisitHistoryService', '$stateParams', '$window', 'visitHistory', 'clinicalDashboardConfig', 'appService',
        'ngDialog', '$filter', 'configurations', 'visitConfig', 'conditionsService', 'configurationService', 'auditLogService', 'confirmBox', 'paymentStatusService', 'visitService', 'electiveSurgeryService','orderTypeService', 'observationsService', 'o2SessionService',
        function ($http,$scope, $rootScope, $state, $location, $translate, clinicalAppConfigService, diagnosisService, urlHelper, contextChangeHandler,
                  spinner, encounterService, messagingService, sessionService, retrospectiveEntryService, patientContext, $q,
                  patientVisitHistoryService, $stateParams, $window, visitHistory, clinicalDashboardConfig, appService,
                  ngDialog, $filter, configurations, visitConfig, conditionsService, configurationService, auditLogService, confirmBox, paymentStatusService, visitService, electiveSurgeryService,orderTypeService, observationsService, o2SessionService ) {
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var getPreviousActiveCondition = Bahmni.Common.Domain.Conditions.getPreviousActiveCondition;
            var payment_config = appService.getAppDescriptor().getConfigValue("paymentConfig")
            $scope.togglePrintList = false;
            $scope.patient = patientContext.patient;
            $scope.showDashboardMenu = false;

            $scope.isPreAnesthesiaEvaluationForm = false;
            var anesthesiaStatus = "";
            var appointmentId = null;
            var anestheisaStatusPayload = {}
            
            // I am filtering the surgical appointmentId if the patient has one
            appointmentId = parseInt(
                $scope.visitHistory.activeVisit?.attributes?.find(attribute => 
                    attribute.display.includes("Surgery_Appointment")
                )?.display.split(':')[1]?.trim(), 10
            );
            $scope.stateChange = function () {
                return $state.current.name === 'patient.dashboard.show';
            };
            $scope.showComment = true;
            $scope.showSaveAndContinueButton = true;
            
            var endVisit = function () {
                var encounterData = {};
                var visitLocationUuid = "c1e42932-3f10-11e4-adec-0800271c1b75";
                encounterData.patientUuid = $scope.patient.uuid;
                encounterData.locationUuid = visitLocationUuid;
                encounterData.encounterTypeUuid = $rootScope.encounterConfig.getDischargeEncounterTypeUuid();
                encounterData.visitTypeUuid = $scope.$parent.visitHistory.activeVisit.visitType.uuid;
                visitService.endVisit($scope.$parent.visitHistory.activeVisit.uuid);
                
                encounterService.discharge(encounterData).then(function (response) {
                    visitService.endVisit(response.data.visitUuid);
                });        
                
            };

            $scope.visitHistory = visitHistory;
            $scope.consultationBoardLink = clinicalAppConfigService.getConsultationBoardLink();
            $scope.showControlPanel = false;
            $scope.clinicalDashboardConfig = clinicalDashboardConfig;
            $scope.lastvisited = null;

            $scope.openConsultationInNewTab = function () {
                $window.open('#' + $scope.consultationBoardLink, '_blank');
            };

            $scope.toggleDashboardMenu = function () {
                $scope.showDashboardMenu = !$scope.showDashboardMenu;
            };

            $scope.showDashboard = function (dashboard) {
                if (!clinicalDashboardConfig.isCurrentTab(dashboard)) {
                    $scope.$parent.$broadcast("event:switchDashboard", dashboard);
                }
                $scope.showDashboardMenu = false;
            };

            var setPrintAction = function (event, tab) {
                tab.print = function () {
                    $rootScope.$broadcast(event, tab);
                };
            };
            var setDashboardPrintAction = _.partial(setPrintAction, "event:printDashboard", _);
            var setVisitTabPrintAction = function (tab) {
                tab.print = function () {
                    var url = $state.href('patient.dashboard.visitPrint', {
                        visitUuid: visitHistory.activeVisit.uuid,
                        tab: tab.title,
                        print: 'print'
                    });
                    window.open(url, '_blank');
                };
            };

            _.each(visitConfig.tabs, setVisitTabPrintAction);
            _.each(clinicalDashboardConfig.tabs, setDashboardPrintAction);
            $scope.printList = clinicalDashboardConfig.tabs //_.concat(clinicalDashboardConfig.tabs, visitConfig.tabs);

            clinicalDashboardConfig.quickPrints = appService.getAppDescriptor().getConfigValue('quickPrints');
            $scope.printDashboard = function (tab) {
                if (tab) {
                    tab.print();
                } else {
                    clinicalDashboardConfig.currentTab.print();
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

            var getOrderTypeUUidByConceptUuid = function(conceptUuid){
                var params = {
                    q: "bahmni.sqlGet.orderTypeUuidByConceptUuid",
                    conceptUuid: conceptUuid
                    }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                      method: "GET",
                      params: params,
                      withCredentials: true
                      });
            }
            
            $scope.patient.paymentStatus = false;

            $scope.paymentStatus = function(){

                if ($scope.visitHistory.activeVisit.visitType.name === 'IPD'){
                    $scope.patient.paymentStatus = true;
                }
                else if(!payment_config["disable checking"]){
                    getOrderUuid().then(resp => resp.data[0] ? paymentStatusService.getPaymentStatus(resp.data[0].uuid).then(function (response) {
                        $scope.patient.paymentStatus = response.data;
                    }):$scope.patient.paymentStatus = false)
                }
                else{
                    $scope.patient.paymentStatus = true;
                }
                let age = DateUtil.diffInYearsMonthsDays($scope.patient.birthdate, DateUtil.now());
                if(age.years==0 && age.months==0 && age.days<=28 && $scope.visitHistory.activeVisit){
                    let visitType = $scope.visitHistory.activeVisit.visitType.name
                    if(visitType == "Neonatology ICU" || visitType == "NICU" || visitType.toLowerCase() == "delivery ward"){
                        $scope.newborn = true;
                    }

                }
            }
            $scope.allowConsultation = function () {
                return appService.getAppDescriptor().getConfigValue('allowConsultationWhenNoOpenVisit');
            };

            $scope.closeDashboard = function (dashboard) {
                clinicalDashboardConfig.closeTab(dashboard);
                $scope.$parent.$parent.$broadcast("event:switchDashboard", clinicalDashboardConfig.currentTab);
            };

            $scope.closeAllDialogs = function () {
                ngDialog.closeAll();
            };

            $scope.availableBoards = [];
            $scope.configName = $stateParams.configName;

            $scope.getTitle = function (board) {
                return $filter('titleTranslate')(board);
            };

            // $scope.hasDiagnosis = function(boardIndex){
            //     if(boardIndex < 6) return true
            //     return $scope.consultation.conditions.length > 0 || ($scope.visitHistory.activeVisit.attributes[0] && ($scope.visitHistory.activeVisit.attributes[0].display == "Visit Status: IPD" || $scope.visitHistory.activeVisit.attributes[0].display.includes("Linkage:")) && $scope.consultation.pastDiagnoses.length > 0) || $scope.consultation.savedDiagnosesFromCurrentEncounter.length > 0
            // }

            $scope.showBoard = function (boardIndex) {
                $rootScope.collapseControlPanel();
                return buttonClickAction($scope.availableBoards[boardIndex]);
            };

            $scope.gotoPatientDashboard = function () {
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                if (contextChangeHandler.execute()["allow"]) {
                    var params = {
                        configName: $scope.configName,
                        patientUuid: patientContext.patient.uuid,
                        encounterUuid: undefined
                    };
                    if ($scope.dashboardDirty) {
                        params['dashboardCachebuster'] = Math.random();
                    }
                    $state.go("patient.dashboard.show", params);
                }
            };

            var isLongerName = function (value) {
                return value ? value.length > 18 : false;
            };

            $scope.getShorterName = function (value) {
                return isLongerName(value) ? value.substring(0, 15) + "..." : value;
            };

            $scope.isInEditEncounterMode = function () {
                return $stateParams.encounterUuid !== undefined && $stateParams.encounterUuid !== 'active';
            };

            $scope.enablePatientSearch = function () {
                return appService.getAppDescriptor().getConfigValue('allowPatientSwitchOnConsultation') === true;
            };

            var setCurrentBoardBasedOnPath = function () {
                var currentPath = $location.url();
                var board = _.find($scope.availableBoards, function (board) {
                    if (board.url === "treatment") {
                        return _.includes(currentPath, board.extensionParams ? board.extensionParams.tabConfigName : board.url);
                    }
                    return _.includes(currentPath, board.url);
                });
                if (board) {
                    $scope.currentBoard = board;
                    $scope.currentBoard.isSelectedTab = true;
                }
            };

            var initialize = function () {
                $scope.paymentStatus();
                var appExtensions = clinicalAppConfigService.getAllConsultationBoards();
                $scope.adtNavigationConfig = {forwardUrl: Bahmni.Clinical.Constants.adtForwardUrl, title: $translate.instant("CLINICAL_GO_TO_DASHBOARD_LABEL"), privilege: Bahmni.Clinical.Constants.adtPrivilege };
                $scope.availableBoards = $scope.availableBoards.concat(appExtensions);
                $scope.showSaveConfirmDialogConfig = appService.getAppDescriptor().getConfigValue('showSaveConfirmDialog');
                var adtNavigationConfig = appService.getAppDescriptor().getConfigValue('adtNavigationConfig');
                Object.assign($scope.adtNavigationConfig, adtNavigationConfig);
                setCurrentBoardBasedOnPath();
            };

            $scope.shouldDisplaySaveConfirmDialogForStateChange = function (toState, toParams, fromState, fromParams) {
                if (toState.name.match(/patient.dashboard.show.*/)) {
                    return fromParams.patientUuid != toParams.patientUuid;
                }
                return true;
            };

            var cleanUpListenerStateChangeStart = $scope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
                if ($scope.showSaveConfirmDialogConfig) {
                    if ($rootScope.hasVisitedConsultation && $scope.shouldDisplaySaveConfirmDialogForStateChange(toState, toParams, fromState, fromParams)) {
                        if ($scope.showConfirmationPopUp) {
                            event.preventDefault();
                            spinner.hide(toState.spinnerToken);
                            ngDialog.close();
                            $scope.toStateConfig = {toState: toState, toParams: toParams};
                            $scope.displayConfirmationDialog();
                        }
                    }
                }
                setCurrentBoardBasedOnPath();
            });

            $scope.adtNavigationURL = function (visitUuid) {
                return appService.getAppDescriptor().formatUrl($scope.adtNavigationConfig.forwardUrl, {'patientUuid': $scope.patient.uuid, 'visitUuid': visitUuid});
            };

            var cleanUpListenerErrorsOnForm = $scope.$on("event:errorsOnForm", function () {
                $scope.showConfirmationPopUp = true;
            });

            $scope.displayConfirmationDialog = function (event) {
                if ($rootScope.hasVisitedConsultation && $scope.showSaveConfirmDialogConfig) {
                    if (event) {
                        event.preventDefault();
                        $scope.targetUrl = event.currentTarget.getAttribute('href');
                    }
                    ngDialog.openConfirm({template: '../common/ui-helper/views/saveConfirmation.html', scope: $scope});
                }
                if ($scope.showTeleConsultationWindow) {
                    var childScope = {};
                    childScope.message = 'Please end teleconsultation before moving out of this window';
                    childScope.ok = okEvent;
                    if (event) {
                        event.preventDefault();
                        confirmBox({
                            scope: childScope,
                            actions: [{name: 'ok', display: 'Ok'}],
                            className: "ngdialog-theme-default delete-program-popup"
                        });
                    }
                }
            };

            var okEvent = function (closeDialog) {
                closeDialog();
            };

            var cleanUpListenerStateChangeSuccess = $scope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
                if (toState.name.match(/patient.dashboard.show.+/)) {
                    $rootScope.hasVisitedConsultation = true;
                    $scope.showConfirmationPopUp = true;
                    if ($scope.showSaveConfirmDialogConfig) {
                        $rootScope.$broadcast("event:pageUnload");
                    }
                }
                if ((toState.name === fromState.name) && (fromState.name === "patient.dashboard.show")) {
                    $rootScope.hasVisitedConsultation = false;
                }
            });

            $scope.$on("$destroy", function () {
                cleanUpListenerStateChangeSuccess();
                cleanUpListenerErrorsOnForm();
                cleanUpListenerStateChangeStart();
            });

            $scope.cancelTransition = function () {
                $scope.showConfirmationPopUp = true;
                ngDialog.close();
                delete $scope.targetUrl;
            };

            $scope.saveAndContinue = function () {
                $scope.showConfirmationPopUp = false;
                $scope.save($scope.toStateConfig);
                $window.onbeforeunload = null;
                ngDialog.close();
            };

            $scope.continueWithoutSaving = function () {
                $scope.showConfirmationPopUp = false;
                if ($scope.targetUrl) {
                    $window.open($scope.targetUrl, "_self");
                }
                $window.onbeforeunload = null;
                $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams);
                ngDialog.close();
            };

            var getUrl = function (board) {
                var urlPrefix = urlHelper.getPatientUrl();
                var url = "/" + $stateParams.configName + (board.url ? urlPrefix + "/" + board.url : urlPrefix);
                var queryParams = [];
                if ($state.params.encounterUuid) {
                    queryParams.push("encounterUuid=" + $state.params.encounterUuid);
                }
                if ($state.params.programUuid) {
                    queryParams.push("programUuid=" + $state.params.programUuid);
                }

                if ($state.params.enrollment) {
                    queryParams.push("enrollment=" + $state.params.enrollment);
                }

                if ($state.params.dateEnrolled) {
                    queryParams.push("dateEnrolled=" + $state.params.dateEnrolled);
                }

                if ($state.params.dateCompleted) {
                    queryParams.push("dateCompleted=" + $state.params.dateCompleted);
                }

                var extensionParams = board.extensionParams;
                angular.forEach(extensionParams, function (extensionParamValue, extensionParamKey) {
                    queryParams.push(extensionParamKey + "=" + extensionParamValue);
                });

                if (!_.isEmpty(queryParams)) {
                    url = url + "?" + queryParams.join("&");
                }

                $scope.lastConsultationTabUrl.url = url;
                return $location.url(url);
            };

            $scope.openConsultation = async function () {
                if(($rootScope.currentUser.currentLocation || "").toLowerCase() === "pict corner".toLowerCase()){
                    $rootScope.pictForm = true;
                    $location.path($location.path() + "/concept-set-group/observations");
                }else{
                    var visit = $scope.visitHistory?.visits?.[1];

                    var isCentralTriage = (visit?.visitType?.name || "").toLowerCase() === "central triage";

                    var CentralVisitUuid = visit?.uuid || null;

                    if (!isCentralTriage){
                            if ($scope.showSaveConfirmDialogConfig) {
                                $rootScope.$broadcast("event:pageUnload");
                            }
                            $scope.closeAllDialogs();
                            $scope.collapseControlPanel();
                            $rootScope.hasVisitedConsultation = true;
                            switchToConsultationTab();
                    }else{
                        observationsService.fetch($scope.patient.uuid,"is the patient eligible for testing?","latest", null, CentralVisitUuid ,null, null, null)
                        .then(function (response) {
                            if(response.data[0]?.valueAsString?.toLowerCase() === 'client is eligible for testing'){
                                    observationsService.fetch($scope.patient.uuid,"HIV COUNSELING AND TESTING FORM","latest", null, $scope.visitHistory.activeVisit.uuid ,null, null, null)
                                    .then(function (hivFormResponse) {
                                        if(hivFormResponse.data.length === 0){
                                            messagingService.showMessage("error", "Please Send Patient to PICT Corner first");
                                        }else{
                                            if ($scope.showSaveConfirmDialogConfig) {
                                                $rootScope.$broadcast("event:pageUnload");
                                            }
                                            $scope.closeAllDialogs();
                                            $scope.collapseControlPanel();
                                            $rootScope.hasVisitedConsultation = true;
                                            switchToConsultationTab();
                                        }
                                });
                            }else{
                                if ($scope.showSaveConfirmDialogConfig) {
                                    $rootScope.$broadcast("event:pageUnload");
                                }
                                $scope.closeAllDialogs();
                                $scope.collapseControlPanel();
                                $rootScope.hasVisitedConsultation = true;
                                switchToConsultationTab();
                            }

                        });
                    }
                }
            };
            if($location.url().includes("from=serviceAudit")) $rootScope.fromAudit = true;
            var switchToConsultationTab = function () {
                if ($scope.lastConsultationTabUrl.url) {
                    $location.url($scope.lastConsultationTabUrl.url);
                } else {
                    // Default tab
                    getUrl($scope.availableBoards[0]);
                }
            };

            var contextChange = function () {
                return contextChangeHandler.execute();
            };

            var buttonClickAction = function (board) {
                if ($scope.currentBoard === board) {
                    return;
                }
                $scope.isFromSpecialOrdersTab = $scope.currentBoard?.label === "Bacteriology"? true : false;
                if (!isFormValid($scope.isFromSpecialOrdersTab)) {
                    if((($scope.currentBoard?.label === "Bacteriology" && board?.label !== "Bacteriology"))) {
                    } else {
                    $scope.$parent.$broadcast("event:errorsOnForm");
                    return;
                    }
                }

                contextChangeHandler.reset();
                _.map($scope.availableBoards, function (availableBoard) {
                    availableBoard.isSelectedTab = false;
                });

                $scope.currentBoard = board;
                $scope.currentBoard.isSelectedTab = true;
                return getUrl(board);
            };

            var cancelDeathDisposition = function (closeDialog) {
                closeDialog();
            };
            var proceedWithDeathDisposition = function (closeDialog) {
                var attributeDetails = {
                    "dead": true,
                    "causeOfDeath": "Death",
                    "deathDate": new Date(),
                    "deathdateEstimated": false
                };
                var personUuid = $stateParams.patientUuid; 
                $http.post('/openmrs/ws/rest/v1/person/' + personUuid, attributeDetails, {
                    withCredentials: true
                });
                
                //angular.element(document.querySelector('.dashboard-header')).scope().deadPerson = true;
                endVisit();
                $scope.deadPerson = true;
                messagingService.showMessage("error", "The patient has been set to deceased.");
                $scope.confirmedDead = true;
                $scope.save($scope.temptoStateConfig);
                closeDialog();
                $location.path($location.path().replace("/disposition", ""));
            };
            var confirmSave = function () {
                var childScope = {};
                childScope.message = 'You are about to set the disposition of this patient as dead. This action is irreversible, are you sure you want to proceed?';
                childScope.cancel = cancelDeathDisposition;
                childScope.ok = proceedWithDeathDisposition;
                confirmBox({
                    scope: childScope,
                    actions: [{name: 'cancel', display: 'Cancel'}, {name: 'ok', display: 'Proceed'}],
                    className: "ngdialog-theme-default delete-program-popup"
                })
            };

            var preSaveEvents = function () {
                var observationForms = $scope.consultation.observationForms;
                var addedObservationForms = _.filter(observationForms, function (form) {
                    return form.isAdded;
                });
                _.each(addedObservationForms, function (form) {
                    if (form.component && form.events && form.events.onFormSave) {
                        try {
                   form.component.state.data = runEventScript(form.component.state.data,
                                form.events.onFormSave, form.component.props && form.component.props.patient);
                        } catch (error) {
                            throw error;
                        }
                    }
                });
            };

            // ============================================================
            // HIV Test Result Validation
            // ============================================================
            var isTestResultValid = function() {
                var testResultLabel = Array.from(document.querySelectorAll('label.control-label')).find(function(el) {
                    var text = el.innerText || el.textContent;
                    return text && (text.includes('Test Result') || text.includes('HTC, Result'));
                });
                
                if (!testResultLabel) {
                    return true;
                }
                
                var hasAsterisk = testResultLabel.querySelector('.asterick') || testResultLabel.innerHTML.includes('*');
                
                if (!hasAsterisk) {
                    return true;
                }
                
                var testResultContainer = testResultLabel.closest('.form-group, .leaf-observation-node');
                if (!testResultContainer) {
                    return true;
                }
                
                var hasValue = false;
                var selectedValue = null;
                
                // Check for concept-dropdown
                var conceptDropdown = testResultContainer.querySelector('concept-dropdown');
                if (conceptDropdown) {
                    var dropdownScope = angular.element(conceptDropdown).scope();
                    if (dropdownScope && dropdownScope.observation) {
                        selectedValue = dropdownScope.observation.value;
                    }
                }
                
                // Check for button-select
                if (!selectedValue) {
                    var buttonSelect = testResultContainer.querySelector('button-select');
                    if (buttonSelect) {
                        var buttonScope = angular.element(buttonSelect).scope();
                        if (buttonScope && buttonScope.observation) {
                            selectedValue = buttonScope.observation.value;
                        }
                    }
                }
                
                // Check for selected radio button
                if (!selectedValue) {
                    var selectedRadio = testResultContainer.querySelector('input[type="radio"]:checked');
                    if (selectedRadio && selectedRadio.value) {
                        selectedValue = selectedRadio.value;
                    }
                }
                
                // Check for select dropdown
                if (!selectedValue) {
                    var selectValue = testResultContainer.querySelector('select');
                    if (selectValue && selectValue.value && selectValue.value !== '') {
                        selectedValue = selectValue.value;
                    }
                }
                
                // Check for button-select active class
                if (!selectedValue) {
                    var buttonSelectActive = testResultContainer.querySelector('.button-select .active, .btn-group .active');
                    if (buttonSelectActive) {
                        selectedValue = buttonSelectActive.innerText || buttonSelectActive.textContent;
                    }
                }
                
                if (selectedValue && typeof selectedValue === 'object') {
                    selectedValue = selectedValue.name || selectedValue.display;
                }
                
                hasValue = selectedValue && selectedValue !== '' && selectedValue !== 'undefined' && selectedValue !== null;
                
                if (!hasValue) {
                    messagingService.showMessage('error', 'Test Result is required. Please select Negative or Positive.');
                    testResultContainer.style.border = '1px solid red';
                    testResultContainer.style.backgroundColor = '#fff0f0';
                    setTimeout(function() {
                        testResultContainer.style.border = '';
                        testResultContainer.style.backgroundColor = '';
                    }, 3000);
                    return false;
                }
                
                return true;
            };

            var preSavePromise = function () {
                var deferred = $q.defer();
                var observationFilter = new Bahmni.Common.Domain.ObservationFilter();

                $scope.consultation.preSaveHandler.fire();
                $scope.lastvisited = $scope.consultation.lastvisited;

                var selectedObsTemplate = $scope.consultation.selectedObsTemplate;
                var tempConsultation = angular.copy($scope.consultation);

                tempConsultation.observations = observationFilter.filter(tempConsultation.observations);
                tempConsultation.consultationNote = observationFilter.filter([tempConsultation.consultationNote])[0];
                tempConsultation.labOrderNote = observationFilter.filter([tempConsultation.labOrderNote])[0];


                orderTypeService.loadAll().then(function (orderTypes) {
                    $scope.orderTypes = orderTypes;
                    $scope.labOrderTypeUuid = orderTypeService.getOrderTypeUuid("Lab Order");

                    // Wait for all order type lookups to complete
                    var lookupPromises = tempConsultation.orders.map(function (order) {
                        return getOrderTypeUUidByConceptUuid(order.concept.uuid).then(function (response) {
                            var orderTypeUuid = response?.data[0]?.order_type_uuid;
                            if (orderTypeUuid && orderTypeUuid === $scope.labOrderTypeUuid) {
                                var comment = order.commentToFulfiller || '';
                                if(!$scope.consultation.orderPhoneNumber){
                                  tempConsultation.orders = tempConsultation.orders.filter(function(o) {
                                          if(o.concept.name == order.concept.name && !order?.commentToFulfiller?.includes('[Contact:')){
                                            messagingService.showMessage('error', "Phone Number is required for lab orders");
                                          }
                                          return o.concept.name !== order.concept.name;
                                      });
                                  return;
                                }
                                var phone = ($scope.consultation.orderPhoneNumber || '').trim();
                                if (phone) {
                                    if (!comment.includes('[Contact:')) {
                                        if (comment.length > 0 && !/[.!?]$/.test(comment.trim())) {
                                            comment = comment.trim() + '.';
                                        }
                                        comment += ' [Contact: ' + phone + ']';
                                        order.commentToFulfiller = comment.trim();
                                    }
                                }
                            }
                        });
                    });

                    // Continue after all lookups are done
                    $q.all(lookupPromises).then(function () {
                        addFormObservations(tempConsultation);
                        storeTemplatePreference(selectedObsTemplate);

                        var visitTypeForRetrospectiveEntries = clinicalAppConfigService.getVisitTypeForRetrospectiveEntries();
                        var defaultVisitType = clinicalAppConfigService.getDefaultVisitType();

                        var encounterData = new Bahmni.Clinical.EncounterTransactionMapper().map(
                            tempConsultation,
                            $scope.patient,
                            sessionService.getLoginLocationUuid(),
                            retrospectiveEntryService.getRetrospectiveEntry(),
                    visitTypeForRetrospectiveEntries,
                    defaultVisitType,
                    $scope.isInEditEncounterMode(),
                    $state.params.enrollment
                );

                deferred.resolve(encounterData);
            });
        });

        return deferred.promise;
    };

            var saveConditions = function () {
                return conditionsService.save($scope.consultation.conditions, $scope.patient.uuid)
                    .then(function () {
                        return conditionsService.getConditions($scope.patient.uuid);
                    }).then(function (savedConditions) {
                        return savedConditions;
                    });
            };

            var storeTemplatePreference = function (selectedObsTemplate) {
                var templates = [];
                _.each(selectedObsTemplate, function (template) {
                    var templateName = template.formName || template.conceptName;
                    var isTemplateAlreadyPresent = _.find(templates, function (template) {
                        return template === templateName;
                    });
                    if (_.isUndefined(isTemplateAlreadyPresent)) {
                        templates.push(templateName);
                    }
                });

                var data = {
                    "patientUuid": $scope.patient.uuid,
                    "providerUuid": $rootScope.currentProvider.uuid,
                    "templates": templates
                };

                if (!_.isEmpty(templates)) {
                    localStorage.setItem("templatePreference", JSON.stringify(data));
                }
            };

            var discontinuedDrugOrderValidation = function (removableDrugs) {
                var discontinuedDrugOrderValidationMessage;
                _.find(removableDrugs, function (drugOrder) {
                    if (!drugOrder.dateStopped) {
                        if (drugOrder._effectiveStartDate < moment()) {
                            discontinuedDrugOrderValidationMessage = "Please make sure that " + drugOrder.concept.name + " has a stop date between " + DateUtil.getDateWithoutTime(drugOrder._effectiveStartDate) + " and " + DateUtil.getDateWithoutTime(DateUtil.now());
                            return true;
                        } else {
                            discontinuedDrugOrderValidationMessage = drugOrder.concept.name + " should have stop date as today's date since it is a future drug order";
                            return true;
                        }
                    }
                });
                return discontinuedDrugOrderValidationMessage;
            };

            var addFormObservations = function (tempConsultation) {
                if (tempConsultation.observationForms) {
                    _.remove(tempConsultation.observations, function (observation) {
                        return observation.formNamespace;
                    });
                    _.each($scope.consultation.observationForms, function (observationForm) {
                        if (observationForm.component && observationForm.isAdded) {
                            var formObservations = observationForm.component.getValue();
                            _.each(formObservations.observations, function (obs) {
                                tempConsultation.observations.push(obs);
                            });
                        }
                    });
                }
            };

            var isObservationFormValid = function () {
                var valid = true;
                _.each($scope.consultation.observationForms, function (observationForm) {
                    if (valid && observationForm.component) {
                        var value = observationForm.component.getValue();
                        if (value.errors) {
                            messagingService.showMessage('error', "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                            valid = false;
                        }
                    }
                });
                return valid;
            };

            var isFormValid = function (isFromSpecialOrdersTab = false) {
                var contxChange = contextChange();
                var shouldAllow = contxChange["allow"];
                var discontinuedDrugOrderValidationMessage = discontinuedDrugOrderValidation($scope.consultation.discontinuedDrugs);
                if (!shouldAllow && !isFromSpecialOrdersTab) {
                    var errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                    messagingService.showMessage('error', errorMessage);
                } else if (discontinuedDrugOrderValidationMessage) {
                    var errorMessage = discontinuedDrugOrderValidationMessage;
                    messagingService.showMessage('error', errorMessage);
                }
                return shouldAllow && !discontinuedDrugOrderValidationMessage && isObservationFormValid();
            };

            var isOxygenTemplate = function (template) {
                if (!template) { return false; }
                var o2FormUuid = Bahmni.Clinical.Constants.o2Concepts.formConceptUuid;
                var templateUuid = template.id ||
                    template.uuid ||
                    template.formUuid ||
                    (template.concept && template.concept.uuid);
                var templateName = template.formName || template.conceptName || template.name || template.label;
                return templateUuid === o2FormUuid ||
                    templateName === 'St. Peter Oxygen Consumption Registration Form';
            };

            var isOxygenFormActiveOnSave = function () {
                var selectedTemplates = ($scope.consultation && $scope.consultation.selectedObsTemplate) || [];
                var activeTemplate = _.find(selectedTemplates, function (template) {
                    return template && template.klass === 'active';
                });
                return isOxygenTemplate(activeTemplate);
            };

            var hasOrderChanges = function (encounterData) {
                return !_.isEmpty(encounterData.orders) || !_.isEmpty(encounterData.drugOrders);
            };

            var copyConsultationToScope = function (consultationWithDiagnosis, saveContext) {
                consultationWithDiagnosis.preSaveHandler = $scope.consultation.preSaveHandler;
                consultationWithDiagnosis.postSaveHandler = $scope.consultation.postSaveHandler;
                $scope.$parent.consultation = consultationWithDiagnosis;
                $scope.$parent.consultation.postSaveHandler.fire();
                $scope.dashboardDirty = true;

                // O2 calculation/billing should only run when the oxygen form is the active saved form.
                // Done here instead of postSaveHandler.register() because ConsultationController
                // lives in the dashboard-header view (sibling scope, not child of patient.dashboard),
                // so $scope.consultation is not reliably available at init time.
                var visitUuid = $scope.visitHistory && $scope.visitHistory.activeVisit && $scope.visitHistory.activeVisit.uuid;
                var rawUuid = $scope.patient && ($scope.patient.uuid || ($scope.patient.person && $scope.patient.person.uuid));
                var patientUuid = (rawUuid && rawUuid.toString().indexOf('-') !== -1) ? rawUuid : null;
                var shouldRunO2Billing = !!(saveContext && saveContext.shouldRunO2Billing);
                console.log('[O2 PostSave] patientUuid=' + patientUuid + ' visitUuid=' + visitUuid + ' shouldRunO2Billing=' + shouldRunO2Billing);
                if (!shouldRunO2Billing) {
                    console.log('[O2 PostSave] Oxygen form was not the only saved clinical change — skipping O2 calculation/billing');
                    return;
                }
                if (patientUuid && visitUuid) {
                    o2SessionService.runAfterConsultationEncounterSaved(
                        patientUuid,
                        visitUuid,
                        sessionService.getLoginLocationUuid(),
                        saveContext && saveContext.encounterUuid,
                        shouldRunO2Billing
                    );
                } else {
                    console.warn('[O2 PostSave] Missing patientUuid or visitUuid — skipping. raw:', $scope.patient);
                }
            };

            var convertTime = function(observations){
                if(observations){
                    observations = observations.map(function(obs){
                        if(obs.concept.name == "New Medication Administration Form"){
                            _.forEach(obs.groupMembers, function(obs){
                                obs.groupMembers = obs.groupMembers.map(function(obs){
                                    if(obs.concept.name == "Time medication given"){
                                        if(obs.value.toString().includes("AM") || obs.value.toString().includes("PM")){
                                            var date  = new Date().toString().slice(0, 16);
                                            obs.value = moment(date + obs.value).format("HH:mm")
                                        }
                                    }
                                    return obs
                                })
                            })
                        }
                        return obs
                    })
                }
                    return observations
                }


            // --- RECURSIVE SEARCH HELPERS ---
            var findObservationInTree = function (obsArray, conceptName) {
                if (!obsArray || !Array.isArray(obsArray)) return null;
                for (var i = 0; i < obsArray.length; i++) {
                    var obs = obsArray[i];
                    var currentConceptName = (obs.concept && obs.concept.name) || obs.conceptName || obs.label || "";
                    if (currentConceptName === conceptName) {
                        return obs;
                    }
                    if (obs.groupMembers && obs.groupMembers.length > 0) {
                        var found = findObservationInTree(obs.groupMembers, conceptName);
                        if (found) return found;
                    }
                }
                return null;
            };

            // Check if "Status for Anesthesia" exists and update the anesthesiaStatus variable to surgical appointment
            const checkAnesthesiaStatus = (groupMembers) => {
                anesthesiaStatus = ""; // Reset
                if (!Array.isArray(groupMembers)) {
                    console.error("groupMembers is not an array");
                    return;
                }
                
                const statusObservation = groupMembers.find(
                    (member) => (member.label === "Status for Anesthesia" || (member.concept && member.concept.name === "Status for Anesthesia"))
                );

                if (statusObservation) {
                    // Try to get the name from autocompleteValue OR value (the save transaction usually uses 'value')
                    var statusValueObj = statusObservation.autocompleteValue || statusObservation.value;
                    var statusName = (statusValueObj && statusValueObj.name ? statusValueObj.name : "").toLowerCase();
                    
                    if (statusName.includes("unfit for anesthesia")) {
                        anesthesiaStatus = "UNFIT";
                    } else if (statusName.includes("fit for anesthesia")) {
                        anesthesiaStatus = "FIT";
                    } else {
                        console.error("Status not recognized: " + statusName);
                    }
                } else {
                    console.error("Status for Anesthesia not found");
                }
            };


            //will use this later to check if its only anestheisa personnel updating the form
            $scope.hasPrivilege = function () {
                return _.find($rootScope.currentUser.privileges, function (privilege) {
                    //asume you have created "anesthesia:preAnesthesiaEvaluation " privilege in openmrs
                    return privilege.name === 'anesthesia:preAnesthesiaEvaluation';
                });
            };        

            $scope.save = function (toStateConfig) {
                // Check Test Result validation first
                if (!isTestResultValid()) {
                    return $q.when({});
                }
                
                if ($rootScope.deadToSave && !$scope.confirmedDead) {
                    $scope.temptoStateConfig = toStateConfig;
                    confirmSave();
                    return $q.when({});;
                }
                if (!isFormValid()) {
                    $scope.$parent.$parent.$broadcast("event:errorsOnForm");
                    return $q.when({});
                }
                try {
                    preSaveEvents();
                    var latestSavedEncounterUuid = null;
                    var shouldRunO2BillingForSave = false;
                    return spinner.forPromise($q.all([preSavePromise(),
                        encounterService.getEncounterType($state.params.programUuid, sessionService.getLoginLocationUuid())]).then(function (results) {
                            var encounterData = results[0];
                            encounterData.observations = convertTime(encounterData.observations)
                            shouldRunO2BillingForSave = isOxygenFormActiveOnSave() && !hasOrderChanges(encounterData);

                            //uncomment and add the logics here to only allow anestheisa perosnnel to update anestheisa status
                            // if ($scope.hasPrivilege()) {    
                            // if(appointmentId != NaN && appointmentId > 0 && (encounterData.observations[0].conceptSetName === "PREANESTHETIC EVALUATION FORM")) {
                            //     $scope.isPreAnesthesiaEvaluationForm = true; 
                            //     checkAnesthesiaStatus(encounterData.observations[0].groupMembers);
                            //     anestheisaStatusPayload["anesthesiaStatus"] = anesthesiaStatus;  
                            // }                          
                            //  }

                            //this will only get executed if has anesthesia privilege, has active surgical appointmetn
                            //the form name is "PREANESTHETIC EVALUATION FORM" make sure its the same with the name in openmrs cocnept dictionary  
                                     
                            // if(appointmentId != NaN && appointmentId > 0 && (encounterData?.observations[0]?.conceptSetName === "SAINT PETER PREOPERATIVE EVALUATION SHEET")) {
                            //     $scope.isPreAnesthesiaEvaluationForm = true; 
                            //     checkAnesthesiaStatus(encounterData.observations[0].groupMembers);
                            //     anestheisaStatusPayload["anesthesiaStatus"] = anesthesiaStatus;  
                            // }
                              if(appointmentId && !isNaN(appointmentId)) {
                                $scope.isPreAnesthesiaEvaluationForm = true; 
                                
                                // Search through the entire save payload tree for the status observation
                                var statusObsInTree = findObservationInTree(encounterData.observations, "Status for Anesthesia");
                                if (statusObsInTree) {
                                    // Use checkAnesthesiaStatus by passing the observation in a list to mimic original logic
                                    checkAnesthesiaStatus([statusObsInTree]);
                                }

                                anestheisaStatusPayload["anesthesiaStatus"] = anesthesiaStatus;  
                            }

                            encounterData.observations.forEach(element => {
                            if (element.concept.name === "Consultation Note") {
                                element.uuid = null;
                            }
                            });

                            encounterData.encounterTypeUuid = results[1].uuid;
                            var params = angular.copy($state.params);
                            params.cachebuster = Math.random();
                            return encounterService.create(encounterData)
                            .then(function (saveResponse) {
                                latestSavedEncounterUuid = saveResponse.data.encounterUuid;
                                var messageParams = {
                                    encounterUuid: saveResponse.data.encounterUuid,
                                    encounterType: saveResponse.data.encounterType
                                };
                                auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                                var consultationMapper = new Bahmni.ConsultationMapper(configurations.dosageFrequencyConfig(), configurations.dosageInstructionConfig(),
                                    configurations.consultationNoteConcept(), configurations.labOrderNotesConcept(), $scope.followUpConditionConcept);
                                var consultation = consultationMapper.map(saveResponse.data);
                                consultation.lastvisited = $scope.lastvisited;
                                return consultation;
                            }).then(function (savedConsultation) {
                                return spinner.forPromise(diagnosisService.populateDiagnosisInformation($scope.patient.uuid, savedConsultation)
                                    .then(function (consultationWithDiagnosis) {
                                        return saveConditions().then(function (savedConditions) {
                                            consultationWithDiagnosis.conditions = savedConditions;
                                            messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                        }, function () {
                                            consultationWithDiagnosis.conditions = $scope.consultation.conditions;
                                        }).then(function () {
                                            copyConsultationToScope(consultationWithDiagnosis, {
                                                encounterUuid: latestSavedEncounterUuid,
                                                shouldRunO2Billing: shouldRunO2BillingForSave
                                            });
                                            if ($scope.targetUrl) {
                                                return $window.open($scope.targetUrl, "_self");
                                            }
                                            return $state.transitionTo(toStateConfig ? toStateConfig.toState : $state.current, toStateConfig ? toStateConfig.toParams : params, {
                                                inherit: false,
                                                notify: true,
                                                reload: (toStateConfig !== undefined)
                                            });
                                        }).then(function () {
                                            //we check if the visit is sent from surgical waitinglist for anesthesia evaluation
                                            if(appointmentId > 0 && anestheisaStatusPayload.anesthesiaStatus) {
                                                electiveSurgeryService.updateAnesthesiaStatus(anestheisaStatusPayload, appointmentId)
                                                .then(function (response) {
                                                    messagingService.showMessage('info', "Anesthesia status updated successfully");
                                                })
                                                .catch(function (error) {
                                                    messagingService.showMessage('error', "unable to update anestehsia status for patient, please make sure surigical waitlist is up and running");
                                                    console.error("unable to update anestehsia status for patient, please make sure surigical waitlist is up and running:", error);
                                                });
                                          }
                                        })
                                    }));
                            }).catch(function (error) {
                                var message = Bahmni.Clinical.Error.translate(error) || "{{'CLINICAL_SAVE_FAILURE_MESSAGE_KEY' | translate}}";
                                messagingService.showMessage('error', message);
                            });
                        }));
                } catch (error) {
                    var displayErrors = function (error) {
                        if (angular.isArray(error)) {
                            _.each(error, function (errorObj) {
                                messagingService.showMessage('error', errorObj.message || '[ERROR]');
                            });
                        } else {
                            messagingService.showMessage('error', error.message || '[ERROR]');
                        }
                    };
                    return spinner.forPromise(Promise.resolve(displayErrors(error)));
                }
            };

            initialize();
        }]);
 