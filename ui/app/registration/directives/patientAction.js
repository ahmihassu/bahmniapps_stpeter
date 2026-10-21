'use strict';

angular.module('bahmni.registration')
    .directive('patientAction', ['$window', '$location', '$state', 'spinner', '$rootScope', '$stateParams',
        '$bahmniCookieStore', 'appService', 'visitService', 'sessionService', 'encounterService',
        'messagingService', '$translate', 'auditLogService', 'ngDialog',
        function ($window, $location, $state, spinner, $rootScope, $stateParams,
                  $bahmniCookieStore, appService, visitService, sessionService, encounterService,
                  messagingService, $translate, auditLogService, ngDialog) {
            var controller = function ($scope) {
                var self = this;
                var uuid = $stateParams.patientUuid;
                var editActionsConfig = appService.getAppDescriptor().getExtensions(Bahmni.Registration.Constants.nextStepConfigId, "config") || [];
                var conceptSetExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "config");
                var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
                var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
                defaultVisitType = defaultVisitType || appService.getAppDescriptor().getConfigValue('defaultVisitType');
                var showStartVisitButton = appService.getAppDescriptor().getConfigValue("showStartVisitButton");
                var forwardUrlsForVisitTypes = appService.getAppDescriptor().getConfigValue("forwardUrlsForVisitTypes");
                showStartVisitButton = (_.isUndefined(showStartVisitButton) || _.isNull(showStartVisitButton)) ? true : showStartVisitButton;
                var visitLocationUuid = $rootScope.visitLocation;
                var forwardUrls = forwardUrlsForVisitTypes || false;
                $scope.selectedVisitType = {};
                $scope.patientRegisterType = "";



                $scope.isCurrentVisitTypeSelected = function (visitType) {
                    var val =  defaultVisitType === visitType.name;
                    if (val) $scope.selectedVisitType = visitType;
                    return val;
                };

                var getForwardUrlEntryForVisitFromTheConfig = function () {
                    var matchedEntry = _.find(forwardUrls, function (entry) {
                        if (self.hasActiveVisit) {
                            return entry.visitType === self.activeVisit.visitType.name;
                        }
                        return entry.visitType === $scope.visitControl.selectedVisitType.name;
                    });
                    return matchedEntry;
                };

                var keyForActiveVisitEntry = function () {
                    var matchedEntry = getForwardUrlEntryForVisitFromTheConfig();
                    if (matchedEntry) {
                        $scope.activeVisitConfig = matchedEntry;
                        if (_.isEmpty(_.get($scope.activeVisitConfig, 'translationKey'))) {
                            $scope.activeVisitConfig.translationKey = "REGISTRATION_LABEL_ENTER_VISIT";
                            $scope.activeVisitConfig.shortcutKey = "REGISTRATION_ENTER_VISIT_DETAILS_ACCESS_KEY";
                        }
                        return 'forwardAction';
                    }
                };

                function setForwardActionKey () {
                    if (editActionsConfig.length === 0) {
                        $scope.forwardActionKey = self.hasActiveVisit ? (getForwardUrlEntryForVisitFromTheConfig() ? keyForActiveVisitEntry() : 'enterVisitDetails') : 'startVisit';
                    } else {
                        $scope.actionConfig = editActionsConfig[0];
                        $scope.forwardActionKey = 'configAction';
                    }
                }

                var init = function () {
                    if (_.isEmpty(uuid)) {
                        self.hasActiveVisit = false;
                        $scope.hasActiveVisit = false;
                        setForwardActionKey();
                        return;
                    }
                    var searchParams = {
                        patient: uuid,
                        includeInactive: false,
                        v: "custom:(uuid,visitType,location:(uuid))"
                    };
                    spinner.forPromise(visitService.search(searchParams).then(function (response) {
                        var results = response.data.results;
                        $scope.existedActiveVisits = results;
                        var activeVisitForCurrentLoginLocation;
                        if (results) {
                            activeVisitForCurrentLoginLocation = _.filter(results, function (result) {
                                return result.location.uuid === visitLocationUuid;
                            });
                        }
                        self.hasActiveVisit = activeVisitForCurrentLoginLocation && (activeVisitForCurrentLoginLocation.length > 0);
                        $scope.hasActiveVisit = self.hasActiveVisit;
                        if (self.hasActiveVisit) {
                            self.activeVisit = activeVisitForCurrentLoginLocation[0];
                        }
                        setForwardActionKey();
                    }));
                   // $scope.selectedVisitType = visitControl != undefined ? visitControl.defaultVisitType: {};
                };
                var filterVisit = function(){
                    var filteredVist = 'IPD'
                    var visits = $rootScope.regEncounterConfiguration.getVisitTypesAsArray();
                     return visits.filter(function (visit){
                          return !filteredVist.includes(visit.name)
                    }) 
                 }

                $scope.visitControl = new Bahmni.Common.VisitControl(
                    filterVisit(),
                    defaultVisitType, encounterService, $translate, visitService
                );

                $scope.startVisit = function (selectedVisit){                  
                    if(selectedVisit != undefined){
                        $scope.selectedVisitType = $scope.visitControl.visitTypes.filter(function (visitType) {
                            return visitType.name === selectedVisit;
                        })[0]; 
                        if($scope.existedActiveVisits !== undefined && $scope.existedActiveVisits.length>0)
                        {
                          visitService.endVisit($scope.existedActiveVisits[0].uuid);
                        }
                        
                        $scope.visitControl.startVisit($scope.selectedVisitType);
                        if($scope.patientRegisterType == "CREATE")
                            $rootScope.$broadcast("event:createPatient", {});
                        else if($scope.patientRegisterType == "SAVETRIAGE"){
                            $rootScope.$broadcast("event:saveTriage", {});
                        }
                        else $rootScope.$broadcast("event:updatePatient", {});
                        ngDialog.close();
                    }                    
                }

                $scope.visitControl.onStartVisit = function () {
                    $scope.setSubmitSource('startVisit');
                };

                $scope.setSubmitSource = function (source) {
                    $scope.actions.submitSource = source;
                };

                $scope.showStartVisitButton = function () {
                    return showStartVisitButton;
                };

                var goToForwardUrlPage = function (patientData) {
                    var forwardUrl = appService.getAppDescriptor().formatUrl($scope.activeVisitConfig.forwardUrl, {'patientUuid': patientData.patient.uuid});
                    $window.location.href = forwardUrl;
                };

                $scope.$on('event:createRegistrationVisit', function () {
                    $scope.patientRegisterType = "CREATE"
                    $scope.startVisit("Registration");   
                });
                $scope.$on('event:newRegistrationVisitForExistingPatient', function () {
                    $scope.patientRegisterType = "EDIT"
                    $scope.startVisit("Registration");   
                });
                $scope.$on('event:openStartVisitPopup', function () {
                    $scope.patientRegisterType = "CREATE"
                    $scope.startVisitPopUpHandler();
                });
                $scope.$on('event:openStartVisitPopupForTriage', function () {
                    $scope.patientRegisterType = "SAVETRIAGE"
                    $scope.startVisitPopUpHandler();
                });

                $scope.$on('event:openStartVisitPopupForEdit', function () {
                    $scope.patientRegisterType = "EDIT"
                    $scope.startVisitPopUpHandler();
                });

                $scope.startVisitPopUpHandler = function () {
                        $scope.dialog = ngDialog.open({ 
                            template: 'views/startVisitPopUp.html', 
                            className: 'test ngdialog-theme-default',
                            scope: $scope});
                            $('body').addClass('show-controller-back');
                    
                };

                $scope.actions.followUpAction = function (patientProfileData) {
                    messagingService.clearAll();
                    switch ($scope.actions.submitSource) {
                    case 'startVisit':
                        var entry = getForwardUrlEntryForVisitFromTheConfig();
                        var forwardUrl = entry ? entry.forwardUrl : undefined;
                        return createVisit(patientProfileData, forwardUrl);
                    case 'forwardAction':
                        return goToForwardUrlPage(patientProfileData);
                    case 'enterVisitDetails':
                        return goToVisitPage(patientProfileData);
                    case 'configAction':
                        return handleConfigAction(patientProfileData);
                    case 'save':
                        var forwardUrl = entry ? entry.forwardUrl : undefined;
                        return createVisit(patientProfileData, forwardUrl);
                    }
                };

                var handleConfigAction = function (patientProfileData) {
                    var forwardUrl = appService.getAppDescriptor().formatUrl($scope.actionConfig.extensionParams.forwardUrl, {'patientUuid': patientProfileData.patient.uuid});
                    if (!self.hasActiveVisit) {
                        createVisit(patientProfileData, forwardUrl);
                    } else {
                        $window.location.href = forwardUrl;
                    }
                };

                var goToVisitPage = function (patientData) {
                    $scope.patient.uuid = patientData.patient.uuid;
                    $scope.patient.name = patientData.patient.person.names[0].display;
                    $location.path("/patient/" + patientData.patient.uuid + "/visit");
                };

                var isEmptyVisitLocation = function () {
                    return _.isEmpty($rootScope.visitLocation);
                };

                var createVisit = function (patientProfileData, forwardUrl) {
                    if (isEmptyVisitLocation()) {
                        $state.go('patient.edit', {patientUuid: $scope.patient.uuid}).then(function () {
                            messagingService.showMessage("error", "NO_LOCATION_TAGGED_TO_VISIT_LOCATION");
                        });
                        return;
                    }
                    spinner.forPromise($scope.visitControl.createVisitOnly(patientProfileData.patient.uuid, $rootScope.visitLocation, $scope.patient["Is Emergency"], $scope.patient?.isMedicoLegal).then(function (response) {
                        auditLogService.log(patientProfileData.patient.uuid, "OPEN_VISIT", {visitUuid: response.data.uuid, visitType: response.data.visitType.display}, 'MODULE_LABEL_REGISTRATION_KEY');
                        if (forwardUrl) {
                            var updatedForwardUrl = appService.getAppDescriptor().formatUrl(forwardUrl, {'patientUuid': patientProfileData.patient.uuid});
                            $window.location.href = updatedForwardUrl;
                        } else {
                            goToVisitPage(patientProfileData);
                        }
                    }, function () {
                        $state.go('patient.edit', {patientUuid: $scope.patient.uuid});
                    }));
                };

                init();
            };
            return {
                restrict: 'E',
                templateUrl: 'views/patientAction.html',
                controller: controller
            };
        }
    ]);
