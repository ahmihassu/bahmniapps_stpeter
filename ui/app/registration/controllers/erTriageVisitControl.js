'use strict';

angular.module('bahmni.registration')
    .controller('ERTriageVisitController', ['$window', '$scope', '$rootScope', '$state', '$bahmniCookieStore', 'patientService', 'encounterService', '$stateParams', 'spinner', '$timeout', '$q', 'appService', 'openmrsPatientMapper', 'contextChangeHandler', 'messagingService', 'sessionService', 'visitService', '$location', '$translate',
        'auditLogService', 'formService', 'observationsService', 'ngDialog','configurations','locationService', '$http',
        function ($window, $scope, $rootScope, $state, $bahmniCookieStore, patientService, encounterService, $stateParams, spinner, $timeout, $q, appService, openmrsPatientMapper, contextChangeHandler, messagingService, sessionService, visitService, $location, $translate, auditLogService,
                  formService, observationsService,ngDialog, configurations, locationService, $http) {
            var vm = this;
            var patientUuid = $stateParams.patientUuid;
            $rootScope.disable = false
            var triageType = $stateParams.triageType;           
            var erTriageForms = appService.getAppDescriptor().getConfigValue("erTriageFormLookup")
            var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", erTriageForms[triageType][0]);
            var formExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", erTriageForms[triageType][1]);
            $scope.conditionsDisplay = true;
            var locationUuid = sessionService.getLoginLocationUuid();
            var selectedProvider = $rootScope.currentProvider;
            var regEncounterTypeUuid = $rootScope.regEncounterConfiguration.encounterTypes[Bahmni.Registration.Constants.registrationEncounterType];            
            var visitLocationUuid = $rootScope.visitLocation;
            var getPatient = function () {
                var deferred = $q.defer();
                patientService.get(patientUuid).then(function (openMRSPatient) {
                    deferred.resolve(openMRSPatient);
                    $scope.patient = openmrsPatientMapper.map(openMRSPatient);
                    $scope.patient.name = openMRSPatient.patient.person.names[0].display;
                    $scope.patient.uuid = openMRSPatient.patient.uuid;
                    $scope.patient.isMedicoLegal = !!$scope.patient.isMedicoLegal;
                });
                return deferred.promise;
            };

            var getActiveEncounter = function () {
                var deferred = $q.defer();
                encounterService.find({
                    "patientUuid": patientUuid,
                    "providerUuids": !_.isEmpty($scope.currentProvider.uuid) ? [$scope.currentProvider.uuid] : null,
                    "includeAll": false,
                    locationUuid: locationUuid,
                    encounterTypeUuids: [regEncounterTypeUuid]
                }).then(function (response) {
                    deferred.resolve(response);
                    $scope.encounterUuid = response.data.encounterUuid;
                    $scope.observations = response.data.observations;
                });
                return deferred.promise;
            };

            var getAllForms = function () {
                var deferred = $q.defer();
                formService.getFormList($scope.encounterUuid)
                    .then(function (response) {
                        $scope.conceptSets = extensions.map(function (extension) {
                            return new Bahmni.ConceptSet.ConceptSetSection(extension, $rootScope.currentUser, {}, [], {});
                        });

                        $scope.observationForms = getObservationForms(formExtensions, response.data);
                        $scope.conceptSets = $scope.conceptSets.concat($scope.observationForms);

                        $scope.availableConceptSets = $scope.conceptSets.filter(function (conceptSet) {
                            return conceptSet.isAvailable($scope.context);
                        });
                        deferred.resolve(response.data);
                    });
                return deferred.promise;
            };

            $scope.hideFields = appService.getAppDescriptor().getConfigValue("hideFields");

            $scope.updatePatientImage = function (image) {
                var updateImagePromise = patientService.updateImage($scope.patient.uuid, image.replace("data:image/jpeg;base64,", ""));
                spinner.forPromise(updateImagePromise);
                return updateImagePromise;
            };

            var save = function () {
                $scope.encounter = {
                    patientUuid: $scope.patient.uuid,
                    locationUuid: locationUuid,
                    encounterTypeUuid: regEncounterTypeUuid,
                    orders: [],
                    drugOrders: [],
                    extensions: {}
                };

                $bahmniCookieStore.put(Bahmni.Common.Constants.grantProviderAccessDataCookieName, selectedProvider, {
                    path: '/',
                    expires: 1
                });

                $scope.encounter.observations = $scope.observations;
                $scope.encounter.observations = new Bahmni.Common.Domain.ObservationFilter().filter($scope.encounter.observations);

        
                addFormObservations($scope.encounter.observations);

                var createPromise = encounterService.create($scope.encounter);
                spinner.forPromise(createPromise);
                return createPromise.then(function (response) {
                    var messageParams = {encounterUuid: response.data.encounterUuid, encounterType: response.data.encounterType};
                    auditLogService.log(patientUuid, 'EDIT_ENCOUNTER', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    var visitType, visitTypeUuid;
                    visitTypeUuid = response.data.visitTypeUuid;
                    visitService.getVisitType().then(function (response) {
                        visitType = _.find(response.data.results, function (type) {
                            if (type.uuid === visitTypeUuid) {
                                return type;
                            }
                        });
                    });
                });
            };

            var isUserPrivilegedToCloseVisit = function () {
                var applicablePrivs = [Bahmni.Common.Constants.closeVisitPrivilege, Bahmni.Common.Constants.deleteVisitsPrivilege];
                var userPrivs = _.map($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name;
                });
                return _.some(userPrivs, function (privName) {
                    return _.includes(applicablePrivs, privName);
                });
            };

            var searchActiveVisitsPromise = function () {
                return visitService.search({
                    patient: patientUuid, includeInactive: false, v: "custom:(uuid,location:(uuid))"
                }).then(function (response) {
                    var results = response.data.results;
                    var activeVisitForCurrentLoginLocation;
                    if (results) {
                        activeVisitForCurrentLoginLocation = _.filter(results, function (result) {
                            return result.location.uuid === visitLocationUuid;
                        });
                    }

                    var hasActiveVisit = activeVisitForCurrentLoginLocation.length > 0;
                    vm.visitUuid = hasActiveVisit ? activeVisitForCurrentLoginLocation[0].uuid : "";
                    $scope.canCloseVisit = isUserPrivilegedToCloseVisit() && hasActiveVisit;
                });
            };

            $scope.closeVisitIfDischarged = function () {
                visitService.getVisitSummary(vm.visitUuid).then(function (response) {
                    var visitSummary = response.data;
                    if (visitSummary.admissionDetails && !visitSummary.dischargeDetails) {
                        messagingService.showMessage("error", 'REGISTRATION_VISIT_CANNOT_BE_CLOSED');
                        var messageParams = {visitUuid: visitSummary.visitUuid, visitType: visitSummary.visitType};
                        auditLogService.log(patientUuid, 'CLOSE_VISIT_FAILED', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    } else {
                        closeVisit(visitSummary.visitType);
                    }
                });
            };

            var closeVisit = function (visitType) {
                var confirmed = $window.confirm($translate.instant("REGISTRATION_CONFIRM_CLOSE_VISIT"));
                if (confirmed) {
                    visitService.endVisit(vm.visitUuid).then(function () {
                        $location.url(Bahmni.Registration.Constants.patientSearchURL);
                        var messageParams = {visitUuid: vm.visitUuid, visitType: visitType};
                        auditLogService.log(patientUuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    });
                }
            };

            $scope.getMessage = function () {
                return $scope.message;
            };

            var isObservationFormValid = function () {
                var valid = true;
                _.each($scope.observationForms, function (observationForm) {
                    if (valid && observationForm.component) {
                        var value = observationForm.component.getValue();
                        if (value.errors) {
                            messagingService.showMessage('error', "{{'REGISTRATION_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                            valid = false;
                        }
                    }
                });
                return valid;
            };

            var validate = function () {
                var isFormValidated = mandatoryValidate();
                var deferred = $q.defer();
                var contxChange = contextChangeHandler.execute();
                var allowContextChange = contxChange["allow"];
                var errorMessage;
                if (!isObservationFormValid()) {
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                }
                if (!allowContextChange) {
                    errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : 'REGISTRATION_LABEL_CORRECT_ERRORS';
                    messagingService.showMessage('error', errorMessage);
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                } else if (!isFormValidated) { // This ELSE IF condition is to be deleted later.
                    errorMessage = "REGISTRATION_LABEL_ENTER_MANDATORY_FIELDS";
                    messagingService.showMessage('error', errorMessage);
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                } else {
                    deferred.resolve();
                    return deferred.promise;
                }
            };

            // Start :: Registration Page validation
            // To be deleted later - Hacky fix only for Registration Page
            var mandatoryConceptGroup = [];
            var mandatoryValidate = function () {
                conceptGroupValidation($scope.observations);
                return isValid(mandatoryConceptGroup);
            };

            var conceptGroupValidation = function (observations) {
                var concepts = _.filter(observations, function (observationNode) {
                    return isMandatoryConcept(observationNode);
                });
                if (!_.isEmpty(concepts)) {
                    mandatoryConceptGroup = _.union(mandatoryConceptGroup, concepts);
                }
            };
            var isMandatoryConcept = function (observation) {
                if (!_.isEmpty(observation.groupMembers)) {
                    conceptGroupValidation(observation.groupMembers);
                } else {
                    return observation.conceptUIConfig && observation.conceptUIConfig.required;
                }
            };
            var isValid = function (mandatoryConcepts) {
                var concept = mandatoryConcepts.filter(function (mandatoryConcept) {
                    if (mandatoryConcept.hide || mandatoryConcept.hidden) {
                        return false;
                    }
                    if (mandatoryConcept.hasValue()) {
                        return false;
                    }
                    if (mandatoryConcept instanceof Bahmni.ConceptSet.Observation &&
                        mandatoryConcept.conceptUIConfig && mandatoryConcept.conceptUIConfig.multiSelect|| (mandatoryConcept.concept.description && mandatoryConcept.concept.description.split("**").includes("multiSelect"))) {
                        return false;
                    }
                    if (mandatoryConcept.isMultiSelect) {
                        return _.isEmpty(mandatoryConcept.getValues());
                    }
                    return !mandatoryConcept.value;
                });
                return _.isEmpty(concept);
            };
            // End :: Registration Page validation

            var afterSave = function () {
                var forwardUrl = appService.getAppDescriptor().getConfigValue("afterVisitSaveForwardUrl");
                if (forwardUrl != null) {
                    $window.location.href = appService.getAppDescriptor().formatUrl(forwardUrl, {'patientUuid': patientUuid});
                } else {
                    $state.transitionTo($state.current, $state.params, {
                        reload: true,
                        inherit: false,
                        notify: true
                    });
                }
                messagingService.showMessage('info', 'REGISTRATION_LABEL_SAVED');
            };

            $scope.submit = function () {
                return validate().then(save).then(afterSave);
            };

            $scope.today = function () {
                return new Date();
            };

            $scope.disableFormSubmitOnEnter = function () {
                $('.visit-patient').find('input').keypress(function (e) {
                    if (e.which === 13) { // Enter key = keycode 13
                        return false;
                    }
                });
            };

            $scope.getIsMedicoLegalCase = function () {
                return !!($scope.patient && $scope.patient.isMedicoLegal);
            };

            var getConceptSet = function () {
                var visitType = $scope.encounterConfig.getVisitTypeByUuid($scope.visitTypeUuid);
                $scope.context = {visitType: visitType, patient: $scope.patient};
            };

            var getObservationForms = function (extensions, observationsForms) {
                var forms = [];
                var observations = $scope.observations || [];
                _.each(extensions, function (ext) {
                    var options = ext.extensionParams || {};
                    var observationForm = _.find(observationsForms, function (form) {
                        return (form.formName === options.formName || form.name === options.formName);
                    });
                    if (observationForm) {
                        var formUuid = observationForm.formUuid || observationForm.uuid;
                        var formName = observationForm.name || observationForm.formName;
                        var formVersion = observationForm.version || observationForm.formVersion;
                        forms.push(new Bahmni.ObservationForm(formUuid, $rootScope.currentUser, formName, formVersion, observations, formName, ext));
                    }
                });
                return forms;
            };

            $scope.isFormTemplate = function (data) {
                return data.formUuid;
            };

            var addFormObservations = function (observations) {
                if ($scope.observationForms) {
                    _.remove(observations, function (observation) {
                        return observation.formNamespace;
                    });
                    _.each($scope.observationForms, function (observationForm) {
                        if (observationForm.component) {
                            var formObservations = observationForm.component.getValue();
                            _.each(formObservations.observations, function (obs) {
                                observations.push(obs);
                            });
                        }
                    });
                }
            };

            spinner.forPromise($q.all([getPatient(), getActiveEncounter(), searchActiveVisitsPromise()])
                .then(function () {
                    getAllForms().then(function () {
                        getConceptSet();
                    });
                }));
                
                var TraigeColorAndScore;
                var fetchLatestObsFor =  function (concepts) {
                    return  observationsService.fetch(patientUuid, concepts , "latest", null, null, null, null, null).then(function (response) {
                     return response.data;
                  });
                };

                $scope.GotoDispositionPage =  async function () {
                var results = await fetchLatestObsFor(['Triage Color Result', 'Triage Score Result']);
                var url = '';
                    if(results.length > 0){
                     url = '../clinical/index.html#/default/patient/'+patientUuid+'/dashboard/disposition?TriageScoreResult=' + results[1].value + ' &TriageColorResult=' + results[0].value ;
                      } else {
                     url = '../clinical/index.html#/default/patient/'+patientUuid+'/dashboard/disposition' ;
                      }
                    $window.location.href = url;
                };
                var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
                var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
                defaultVisitType = defaultVisitType || appService.getAppDescriptor().getConfigValue('defaultVisitType');
                var regEncounterTypeUuid = $rootScope.regEncounterConfiguration.encounterTypes[Bahmni.Registration.Constants.registrationEncounterType];
                    $scope.visitTypeFilter = function (visitTp){
                    var filteredStatus = _.filter(femaleVisitTypes, function (arrMem) {
                        return arrMem===visitTp.name;
                    });
                    if($scope.patient.gender=='M' && filteredStatus.length>0){
                        return false;    
                    }
                    else{
                        return true;
                    }   
                }
                $scope.visitControl = new Bahmni.Common.VisitControl(
                    $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                    defaultVisitType, encounterService, $translate, visitService
                );

                locationService.getAllByTag("Login Location").then(function (response) {
                    $scope.locations = response.data.results;

                    if (triageType === 'Adult ER' || triageType === 'Pediatrics ER' ) {
                        // Emergency triages goto Adult ER classes
                        const adultERLocations = $scope.locations.filter(function (location) {
                            return location.name === "Adult ER";
                        });

                        $scope.childLocationsOfAdultER = adultERLocations.flatMap(function (location) {
                            return location.childLocations || [];
                        });

                        $scope.childLocationsOfAdultER = $scope.childLocationsOfAdultER.map(function (location) {
                            return {
                                name: location.display,
                                uuid: location.uuid,
                                patientPerVisit: 0
                            };
                        });

                        $scope.visitControl.visitTypes = $scope.childLocationsOfAdultER;

                    } else {
                        // Gyni and labour people go to other wards 
                        const femaleWardNames = ["MCH emergency","MCH re evaluation"];

                        const femaleLocations = $scope.locations.filter(function (location) {
                            return femaleWardNames.includes(location.name);
                        });


                        $scope.visitControl.visitTypes = femaleLocations.map(function (location) {
                            return {
                                name: location.display || location.name,
                                uuid: location.uuid,
                                patientPerVisit: 0
                            };
                        });
                    }

                    // --- Step 2: Update filterLoc based on the final visit types ---
                    $scope.filterLoc = $scope.visitControl.visitTypes.map(function (visitType) {
                        return visitType.name;
                    });
                });
                
                var getPatientPerVisit = async function (){
                    var params = {
                        q: "emrapi.centraltriage.noOfPatientPerVisit"
                    }
                    var response= await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                        method: "GET",
                        params: params,
                        withCredentials: true
                    });
                                    
                    return response.data;
                                 
                };
                
                $scope.startVisitPopUpHandler = async function () {
                    $scope.dialog = ngDialog.open({
                        template: 'views/startVisitPopUp.html', 
                        className: 'test ngdialog-theme-default',
                        scope: $scope});
                        $('body').addClass('show-controller-back');
                };
                $scope.cancel = function(){
                    ngDialog.close();
                }
               $scope.startVisits = async function () {
                    // var noOfPatientsPerVisit = await getPatientPerVisit();
                    // $scope.visitControl.visitTypes.forEach(visitType => { 
                        // noOfPatientsPerVisit.forEach(noOfPatientPerVisit => {
                            // if(noOfPatientPerVisit.name == visitType.name){
                                // visitType.patientPerVisit = noOfPatientPerVisit.NoOfPatientPerVisit;
                            // }
                        // });
                        // if(visitType.patientPerVisit == undefined){
                            // visitType.patientPerVisit = 0;
                        // }
                    // });
                    return validate().then($scope.startVisitPopUpHandler);
                };
                var getCurrLoc = async function () {
                    var params = {
                        q: "bahmni.sqlGet.currLoc"
                    };
                    return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                        method: "GET",
                        params: params,
                        withCredentials: true
                    });
                };
                var encounterConfig = $rootScope.encounterConfig;
                var visitTypes = encounterConfig.getVisitTypes();
                var getVisitTypeUuid = function (triageType) {
                    var visitType = _.find(visitTypes, {name: triageType});
                    return visitType && visitType.uuid || null;
                };
                function getLocationUuidByName(name) {
                    const location = $scope.visitControl.visitTypes.find(location => location.name === name);
                    return location ? location.uuid : null;
                  }
    
                $scope.startVisit = async function (selectedVisit){
                    
                    if(selectedVisit != undefined){
                        selectedVisit = selectedVisit.split(" --- ");
                        $scope.newLocationUuid = getLocationUuidByName(selectedVisit[0])
                        if (triageType === 'Adult ER' || triageType === 'Pediatrics ER' ) $scope.selectedVisitTypeUuid = getVisitTypeUuid(triageType);
                        else $scope.selectedVisitTypeUuid = getVisitTypeUuid(selectedVisit[0]);
                        try {

                            let response = await getCurrLoc();
                            // Assuming the response contains data with a location UUID
                            const locationUUID = response.data[0].uuid;
                            // Assign the location UUID to the scope variable
                            $scope.selectedLocationUUID = locationUUID;
                            // Prepare the visitDetails object for creating the visit
                            var visitDetails = {
                                                patient: patientUuid,
                                                visitType: $scope.selectedVisitTypeUuid, 
                                                location:visitLocationUuid, 
                                                attributes:[{
                                                    value:  $scope.newLocationUuid,
                                                    attributeType: $scope.selectedLocationUUID}]};
                            if ($scope.patient.isMedicoLegal) {
                                await visitService.createEmergencyMedicoVisit(visitDetails);
                            } else {
                                await visitService.createVisit(visitDetails);
                            }            
                            ngDialog.close();
                            $scope.submit();
                        } catch(error) {
                            console.error("An error occurred:", error);
                        }
                        
                    }        
                }  
        }]);