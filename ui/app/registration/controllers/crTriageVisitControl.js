'use strict';

angular.module('bahmni.registration')
    .controller('CRTriageVisitController', ['$window', '$scope', '$rootScope', '$state', '$bahmniCookieStore', 'patientService', 'encounterService', '$stateParams', 'spinner', '$timeout', '$q', 'appService', 'openmrsPatientMapper', 'contextChangeHandler', 'messagingService', 'sessionService', 'visitService', '$location', '$translate',
        'auditLogService', 'formService', 'observationsService', 'ngDialog', '$http', 'queueService',
        function ($window, $scope, $rootScope, $state, $bahmniCookieStore, patientService, encounterService, $stateParams, spinner, $timeout, $q, appService, openmrsPatientMapper, contextChangeHandler, messagingService, sessionService, visitService, $location, $translate, auditLogService,
                  formService, observationsService, ngDialog, $http, queueService) {
            var vm = this;
            $scope.queueCurrentServing = queueService.getPersistedCurrentServing() != null ? queueService.getPersistedCurrentServing() : null;
            $scope.queueAssignPending = false;

            $scope.assignTicketToVisitLocation = function () {
                var ticketNumber = $scope.queueCurrentServing;
                var locationName = $scope.selectedVisitType && $scope.selectedVisitType.name;
                if (ticketNumber == null || ticketNumber === '' || ticketNumber === '—') {
                    messagingService.showMessage('info', 'No queue ticket to assign.');
                    return;
                }
                if (!locationName) {
                    messagingService.showMessage('error', 'Please select a visit type (assignment location) first.');
                    return;
                }
                if ($scope.queueAssignPending) return;
                $scope.queueAssignPending = true;
                queueService.assignTicket(locationName, ticketNumber)
                    .then(function () {
                        messagingService.showMessage('info', 'Ticket ' + ticketNumber + ' assigned to ' + locationName + '.');
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.message) ? err.data.message : 'Assign ticket failed.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.queueAssignPending = false;
                    });
            };

            var triageType = $stateParams.triageType;
            var patientUuid = $stateParams.patientUuid;
            if($rootScope.fromPediatric || $location.url().includes("from=pediatric")) {
                $rootScope.fromPediatric = true;
                //var prTriageForms = appService.getAppDescriptor().getConfigValue("prTriageFormLookup")
                var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "pdconfig");
                var formExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "pdforms");
                //$scope.triageSelected = 'Pediatrics ER'
            }
            else if($rootScope.fromToxicology || $location.url().includes("from=toxicology")){
                 $rootScope.fromToxicology = true;
                 var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "toxTriageconfig");
            }
            else if($rootScope.fromGynecology || $location.url().includes("from=gynecology")){
                $rootScope.fromGynecology = true;
                var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations","gynTriageconfig")
            }
            else{
                var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "crconfig");
                var formExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "crforms");
            }
            
            var locationUuid = sessionService.getLoginLocationUuid();
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
                var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
                defaultVisitType = defaultVisitType || appService.getAppDescriptor().getConfigValue('defaultVisitType');
                
            var selectedProvider = $rootScope.currentProvider;
            var regEncounterTypeUuid = $rootScope.regEncounterConfiguration.encounterTypes[Bahmni.Registration.Constants.registrationEncounterType];
            var visitLocationUuid = $rootScope.visitLocation;
            $scope.noOfPatients = 0;
            var femaleVisitTypes = appService.getAppDescriptor().getConfigValue("femaleOnlyVisitType")
            $scope.conditionsDisplay = extensions[0].extensionParams.conditionsDisplay;
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
            var getPatient = function () {
                var deferred = $q.defer();
                patientService.get(patientUuid).then(function (openMRSPatient) {
                    deferred.resolve(openMRSPatient);
                    $scope.patient = openmrsPatientMapper.map(openMRSPatient);
                    $scope.patient.name = openMRSPatient.patient.person.names[0].display;
                    $scope.patient.uuid = openMRSPatient.patient.uuid;
                    $scope.patient.identifier = openMRSPatient.patient.identifiers[0].identifier;
                    $scope.patient.isMedicoLegal = !!$scope.patient.isMedicoLegal;
                });
                return deferred.promise;
            };

            var getActivePatients = async function (){
                var params = {
                q: "emrapi.centralTriage.activePatientForOPDs",
                visit_type_uuid: $scope.selectedVisitType.uuid
                }
                var response= await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
                var noOfPatient = response.data[0].Number_of_Active_Patient_per_OPD
                return noOfPatient
                             
            };
            
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
                $rootScope.newCRPat = false;
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
                    if(!$rootScope.fromPediatric)
                    visitTypeUuid = $scope.selectedVisitType.uuid;
                    else visitTypeUuid = response.data.visitTypeUuid;
                    visitService.getVisitType().then(function (response) {
                        visitType = _.find(response.data.results, function (type) {
                            if (type.uuid === visitTypeUuid) {
                                return type;
                            }
                            else{
                                return $scope.selectedVisitType;
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
                        mandatoryConcept.conceptUIConfig && mandatoryConcept.conceptUIConfig.multiSelect) {
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
            var closeVisit = function () {
                if(vm!=undefined){
                    visitService.getVisitSummary(vm.visitUuid).then(function (response) {
                        var visitSummary = response.data;
                        visitService.endVisit(vm.visitUuid).then(function () {
                        var messageParams = {visitUuid: visitSummary.visitUuid, visitType: visitSummary.visitType};
                        auditLogService.log(patientUuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    });
                });
                }
            }

            $scope.saveConfirmation = function(){
                closeVisit(); //Close the Visit
                $scope.visitControl.startVisit($scope.selectedVisitType);
                var visitDetails = {patient: patientUuid, visitType: $scope.selectedVisitType.uuid, location: visitLocationUuid};
                visitService.createVisit(visitDetails).then(function (response) {
                });
                $scope.assignTicketToVisitLocation();
                ngDialog.close();
                $scope.submit();    
            }
            $scope.cancel = function(){
                ngDialog.close();
            }

            $scope.conditionSection = {"title":"Conditions","type":"conditionsList","displayOrder":2,"config":{"visitUuids":[vm.visitUuid],"patientUuid":patientUuid}}
            $scope.visitControl = new Bahmni.Common.VisitControl(
                $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                defaultVisitType, encounterService, $translate, visitService
            );
            $scope.startVisit = async function (selectedVisit){
                var noOfPatients = 0;
                if(selectedVisit != undefined){
                    
                    selectedVisit = selectedVisit.split(" --- ");
                    $scope.selectedVisitType = $scope.visitControl.visitTypes.filter(function (visitType) {
                        return visitType.name === selectedVisit[0];
                    })[0];
                    noOfPatients = await getActivePatients();
                    $scope.assignTicketToVisitLocation();
                    if(noOfPatients<35){
                        if(vm!=undefined){
                            visitService.getVisitSummary(vm.visitUuid).then(function (response) {
                                var visitSummary = response.data;
                                //Close the Central Triage Visit
                                visitService.endVisit(vm.visitUuid).then(function () {
                                var messageParams = {visitUuid: visitSummary.visitUuid, visitType: visitSummary.visitType};
                                auditLogService.log(patientUuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                                 
                                //Start the new selected Visit
                                $scope.visitControl.startVisit($scope.selectedVisitType);
                                var visitDetails = {patient: patientUuid, visitType: $scope.selectedVisitType.uuid, location: visitLocationUuid};
                                    if ($scope.patient.isMedicoLegal) {

                                        visitService.createMedicoVisit(visitDetails).then(function (response) { })
                                    } else {
                                        visitService.createVisit(visitDetails).then(function (response) { })
                                    }
                            });
                        });
                        }
                       
                        ngDialog.close();
                        $scope.submit();
                    }

                    else{
                    //Pop up when the number exceed
                    ngDialog.close()
                    $scope.noOfPatients = noOfPatients;
                    $scope.exceededPatienPopupHandler()
                    }
                    
                    ngDialog.close()
                }            
            }

            $scope.exceededPatienPopupHandler = function () {
                $scope.dialog = ngDialog.open({
                    template: 'views/patientExceedPopUp.html', 
                    className: 'ngdialog-theme-default',
                    scope: $scope});
                noOfPatient = 0;
                $('body').addClass('show-controller-back');
            }
                    
                    $scope.visitControl.onStartVisit = function () {
                        $scope.startVisit($scope.visitControl.selectedVisit);
                    };
        
                    $scope.startVisits = async function () {
                        var filteredVisitTypes = ['Ophtha1','Dental clinic','Ophtha2','Psychiatry clinic','Psychiatry Referral Clinic','DermaRegularClinic27',
                                                 'DermaRegularClinic28','DermaRegularClinic29','ENTReferralClinic','ENTClinic','Spina Bifida Hydrocephalus MDT clinic',
                                                 'ENT GP OPD','Dermatology GP OPD','Ophthalmology (18)','Ophthalmology (19)','Minor OR']
                        if($rootScope.fromPediatric){
                            $scope.visitControl.visitTypes = _.filter($scope.visitControl.visitTypes,function (visitType) {                              
                                return visitType.name.includes("Pediat") || filteredVisitTypes.includes(visitType.name)            
                            })
                        }
                        var noOfPatientsPerVisit = await getPatientPerVisit();
                        $scope.visitControl.visitTypes.forEach(visitType => {                         
                            noOfPatientsPerVisit.forEach(noOfPatientPerVisit => {                                
                                if(noOfPatientPerVisit.name == visitType.name){
                                    if(noOfPatientPerVisit.encounter_type)
                                        visitType.seenPatientsPerVisit = noOfPatientPerVisit.NoOfPatientPerVisit;
                                    else
                                        visitType.notSeenPatientsPerVisit = noOfPatientPerVisit.NoOfPatientPerVisit;
                                }
                            });
                            if(visitType.seenPatientsPerVisit == undefined){
                                visitType.seenPatientsPerVisit = 0;
                            }
                            if(visitType.notSeenPatientsPerVisit == undefined){
                                visitType.notSeenPatientsPerVisit = 0;
                            }
                            
                        });
                       return validate().then($scope.startVisitPopUpHandler);
                    };
                    
                    $scope.startVisitPopUpHandler = function () {
                        $scope.dialog = ngDialog.open({
                            template: 'views/startVisitPopUp.html', 
                            className: 'test ngdialog-theme-default',
                            scope: $scope});
                            $('body').addClass('show-controller-back');
                    };
        
            $scope.submit = function () {
                return save().then(afterSave);
            };    

            $scope.today = function () {
                return new Date();
            };
            
            

            /* $scope.changeVisits = function() {
                $scope.encounter = {
                    patientUuid: $scope.patient.uuid,
                    locationUuid: locationUuid,
                    encounterTypeUuid: regEncounterTypeUuid,
                    orders: [],
                    drugOrders: [],
                    extensions: {}
                };
                $scope.encounter.observations = $scope.observations;
                $scope.encounter.observations = new Bahmni.Common.Domain.ObservationFilter().filter($scope.encounter.observations);
                addFormObservations($scope.encounter.observations);
                var createPromise = encounterService.create($scope.encounter);
                spinner.forPromise(createPromise);
                return createPromise.then(function (response) {
                    var messageParams = {encounterUuid: response.data.encounterUuid, encounterType: response.data.encounterType};
                    auditLogService.log(patientUuid, 'EDIT_ENCOUNTER', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    afterSave();
                });

            } */

            $scope.enterVisitDetails = $rootScope.newCRPat;
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
        }]);