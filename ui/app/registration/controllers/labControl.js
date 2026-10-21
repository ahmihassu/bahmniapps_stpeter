'use strict';

angular.module('bahmni.registration')
    .controller('LabController', ['$window', '$scope', '$rootScope', '$state', '$bahmniCookieStore', 'patientService', 'encounterService', '$stateParams', 'spinner', '$timeout', '$q', 'appService', 'openmrsPatientMapper', 'contextChangeHandler', 'messagingService', 'sessionService', 'visitService', '$location', '$translate',
    'auditLogService', 'formService', 'observationsService', 'ngDialog', '$http',
    function ($window, $scope, $rootScope, $state, $bahmniCookieStore, patientService, encounterService, $stateParams, spinner, $timeout, $q, appService, openmrsPatientMapper, contextChangeHandler, messagingService, sessionService, visitService, $location, $translate, auditLogService,
              formService, observationsService, ngDialog, $http) {
        var vm = this;
        var patientUuid = $stateParams.patientUuid;
        var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "labconfig");
        var formExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "labforms");
        var locationUuid = sessionService.getLoginLocationUuid();
        var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
        var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
        defaultVisitType = defaultVisitType || appService.getAppDescriptor().getConfigValue('defaultVisitType');
        var selectedProvider = $rootScope.currentProvider;
        var regEncounterTypeUuid = $rootScope.regEncounterConfiguration.encounterTypes[Bahmni.Registration.Constants.registrationEncounterType];
        var visitLocationUuid = $rootScope.visitLocation;
        var testName;
        if($location.url().includes("test=Cross%20Match")){
            testName = "Cross Match Results";
            $rootScope.testName = "Cross Match Results";
        } 
        else if($location.url().includes("test=TB")){
            testName = "TB Result Form";
            $rootScope.testName = "TB Result Form";
        }
        else if($location.url().includes("test=FNAC")){
            testName = "FNAC Results";
            $rootScope.testName = "FNAC Results";
        }
        else if($location.url().includes("test=PMORPH")){
            testName = "Peripheral Morphology Results";
            $rootScope.testName = "Peripheral Morphology Results";
        }
        else{
            testName = $rootScope.testName
        } 
        $scope.noOfPatients = 0;
        var getPatient = function () {
            var deferred = $q.defer();
            patientService.get(patientUuid).then(function (openMRSPatient) {
                deferred.resolve(openMRSPatient);
                $scope.patient = openmrsPatientMapper.map(openMRSPatient);
                $scope.patient.name = openMRSPatient.patient.person.names[0].display;
                $scope.patient.uuid = openMRSPatient.patient.uuid;
                $scope.patient.identifier = openMRSPatient.patient.identifiers[0].identifier;
                
            });
            return deferred.promise;
        };


        var formData = async function (type, patientUui, numberOfVisits, formGroup, patientProgramUuid) {
            var params = {
                s: type,
                patient: patientUui,
                numberOfVisits: numberOfVisits,
                v: "full",
                conceptNames: formGroup || null,
                patientProgramUuid: patientProgramUuid || null
            };
            return $http.get(Bahmni.Common.Constants.formDataUrl, {params: params});
        };

        var testDoc;
        if(testName == "Cross Match Results") testDoc = ["bt, dr Confirmed and signed"]  
        if(testName == "TB Result Form") testDoc = ["tbrf, Requested Test"]
        if(testName == "FNAC Results") testDoc = ["fnacrf, dr confirmed"]
        if(testName == "Peripheral Morphology Results") testDoc = ["pmorphrf, dr Confirmed and signed"]
        formData("byPatientUuid", patientUuid, 1, testDoc).then(res => {
            $scope.providedBy = res.data.results[0].auditInfo.creator.display
            if(testName == "TB Result Form") $scope.patient.specTsestType = res.data.results[0].value.display
        })



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
                        return conceptSet.isAvailable($scope.context) && conceptSet.label== testName;
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
            var confirmation = ($scope.observations[0].groupMembers.filter(function(obs){
                return obs.concept.name == "tbrf, lb confirmed" || obs.concept.name == "bt, lb Confirmed and signed" || obs.concept.name == "fnacrf, lb Confirmed and signed" || obs.concept.name == "pmorphrf, lb Confirmed and signed"
           })[0].value)
            var forwardUrl = appService.getAppDescriptor().getConfigValue("afterVisitSaveForwardUrl");
            if(confirmation) $window.location.href = appService.getAppDescriptor().formatUrl("../clinical/index.html#/default/patient/search", {'patientUuid': patientUuid});
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
        
        var saver = function(){
            return save().then(afterSave);
        }
        $scope.submit = function () {
           return validate().then(saver)
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

        var getConceptSet = function () {
            var visitType = $scope.encounterConfig.getVisitTypeByUuid($scope.visitTypeUuid);
            $scope.context = {visitType: visitType, patient: $scope.patient};
        };

        var getObservationForms = function (extensions, observationsForms) {
            var forms = [];
            var observations = $scope.observations || [];
            _.each(extensions, function (ext) {
                var options = ext.extensionParams[testName] || {};
                
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
                })
            }));
    }]);