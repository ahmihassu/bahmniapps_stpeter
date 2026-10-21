'use strict';

angular.module('bahmni.clinical')
    .controller('ConceptSetPageController', ['$http', '$scope', '$rootScope', '$stateParams', 'conceptSetService',
        'clinicalAppConfigService', 'messagingService', 'configurations', '$state', 'spinner',
        'contextChangeHandler', '$q', '$translate', 'formService', 'visitFormService',
        function ($http, $scope, $rootScope, $stateParams, conceptSetService,
                  clinicalAppConfigService, messagingService, configurations, $state, spinner,
                  contextChangeHandler, $q, $translate, formService, visitFormService) {
            $scope.consultation.selectedObsTemplate = $scope.consultation.selectedObsTemplate || [];
            $scope.allTemplates = $scope.allTemplates || [];
            $scope.scrollingEnabled = false;
            var extensions = clinicalAppConfigService.getAllConceptSetExtensions($stateParams.conceptSetGroupName);
            var configs = clinicalAppConfigService.getAllConceptsConfig();
            var visitType = configurations.encounterConfig().getVisitTypeByUuid($scope.consultation.visitTypeUuid);
            $scope.context = {visitType: visitType, patient: $scope.patient};
            var numberOfLevels = 2;
            var fields = ['uuid', 'name:(name,display)', 'names:(uuid,conceptNameType,name)'];
            var customRepresentation = Bahmni.ConceptSet.CustomRepresentationBuilder.build(fields, 'setMembers', numberOfLevels);
            var allConceptSections = [];
            $scope.isallobs = $stateParams.conceptSetGroupName == "observations" && !$rootScope.reqDeathNotification && ($rootScope.currentUser.currentLocation || "").toLowerCase() !== "pict corner".toLowerCase();;
            var preInit = function ()
            {
                if ($rootScope.reqDeathNotification)
                {
                    init("Death Notification Forms");
                }
                else if ($rootScope.pictForm) {
                    init("HIV COUNSELING AND TESTING FORMS");
                }
                else if (!$scope.isallobs)
                {
                    init("Special Orders Form", []);
                }
                else 
                {
                    var loc_form = $rootScope.currentUser.currentLocation + " Forms"
                    loc_form = loc_form.includes("*") ? "Adult ER Forms" : loc_form
                    spinner.forPromise(conceptSetService.getConcept({
                            name: loc_form,
                            v: "custom:" + customRepresentation
                        }).then(res => {
                        if(res.data.results.length){
                            init("All Observation Templates",res.data.results[0].setMembers)
                        }
                        else{
                            init("All Observation Templates", [])
                        }
                    }))
                }
                
            }

            var init = function (obs_source, special_forms) {
                console.log();
                
                $scope.consultation.selectedObsTemplate = []
                if (!($scope.allTemplates !== undefined && $scope.allTemplates.length > 0)) {
                    var name = obs_source
                    if($state.params.programUuid!==undefined){
                        name= "Program Observation Templates"
                    }
                    spinner.forPromise(conceptSetService.getConcept({
                        name: name,
                        v: "custom:" + customRepresentation
                     }).then(function (response) {
                        var allTemplates = response.data.results[0].setMembers.concat(special_forms);
                        createConceptSections(allTemplates);
                        if ($state.params.programUuid) {
                            showOnlyTemplatesFilledInProgram();
                        }

                        // Retrieve Form Details
                        if (!($scope.consultation.observationForms !== undefined && $scope.consultation.observationForms.length > 0)) {
                            spinner.forPromise(formService.getFormList($scope.consultation.encounterUuid)
                                .then(function (response) {
                                    $scope.consultation.observationForms = getObservationForms(response.data);
                                    concatObservationForms();
                                })
                            );
                        } else {
                            concatObservationForms();
                        }
                    }));
                }
            };
            var concatObservationForms = function () {
                $scope.allTemplates = getSelectedObsTemplate(allConceptSections);
                $scope.uniqueTemplates = _.uniqBy($scope.allTemplates, 'label');
                $scope.allTemplates = $scope.allTemplates.concat($scope.consultation.observationForms);
                if ($scope.consultation.selectedObsTemplate.length == 0) {
                    initializeDefaultTemplates();
                    if ($scope.consultation.observations && $scope.consultation.observations.length > 0) {
                        addTemplatesInSavedOrder();
                    }
                    var templateToBeOpened = getLastVisitedTemplate() ||
                        _.first($scope.consultation.selectedObsTemplate);

                    if (templateToBeOpened) {
                        openTemplate(templateToBeOpened);
                    }
                }
            };

            var addTemplatesInSavedOrder = function () {
                var templatePreference = JSON.parse(localStorage.getItem("templatePreference"));
                if (templatePreference && templatePreference.patientUuid === $scope.patient.uuid &&
                    !_.isEmpty(templatePreference.templates) && $rootScope.currentProvider.uuid === templatePreference.providerUuid) {
                    insertInSavedOrder(templatePreference);
                } else {
                    insertInDefaultOrder();
                }
            };

            var insertInSavedOrder = function (templatePreference) {
                var templateNames = templatePreference.templates;
                _.each(templateNames, function (templateName) {
                    var foundTemplates = _.filter($scope.allTemplates, function (allTemplate) {
                        return allTemplate.conceptName === templateName;
                    });
                    if (foundTemplates.length > 0) {
                        _.each(foundTemplates, function (template) {
                            if (!_.isEmpty(template.observations)) {
                                insertTemplate(template);
                            }
                        });
                    }
                });
            };

            var insertInDefaultOrder = function () {
                _.each($scope.allTemplates, function (template) {
                    if (template.observations.length > 0) {
                        insertTemplate(template);
                    }
                });
            };

            var insertTemplate = function (template) {
                if (template && !(template.isDefault() || template.alwaysShow)) {
                    $scope.consultation.selectedObsTemplate.push(template);
                }
            };

            var getLastVisitedTemplate = function () {
                return _.find($scope.consultation.selectedObsTemplate, function (template) {
                    return template.id === $scope.consultation.lastvisited;
                });
            };

            var openTemplate = function (template) {
                template.isOpen = true;
                template.isLoaded = true;
                template.klass = "active";
            };

            var initializeDefaultTemplates = function () {
                var toShow = {};
                if($scope.isallobs){
                    $scope.consultation.selectedObsTemplate = _.filter($scope.allTemplates, function (template) {
                        return template.isDefault() || template.alwaysShow;
                    });
                }
                else if ($rootScope.reqDeathNotification || $rootScope.pictForm) {
                    $scope.allTemplates[0].alwaysShow = true;
                    $scope.consultation.selectedObsTemplate = _.filter($scope.allTemplates, function (template) {
                        return template.alwaysShow;
                    });
                    openTemplate(_.first($scope.consultation.selectedObsTemplate));
                }
                else{
                    visitFormService.formData($scope.patient.uuid, 50, ["tbrf, dr confirmed", "tbrf, lb confirmed", "bt, lb Confirmed and signed","bt, dr Confirmed and signed", "btr, date time of request", "fnacrf, dr confirmed", "fnacrf, lb Confirmed and signed", "pmorphrf, dr Confirmed and signed", "pmorphrf, lb Confirmed and signed"]).then(function (res){
                        var pendingBuilder = {}
                        res.data.results.forEach(result => {
                            if(!pendingBuilder[result.display] || pendingBuilder[result.display] < result.obsDatetime){
                                pendingBuilder[result.display] = new Date(result.obsDatetime)
                                if(result.concept.displayString == "btr, date time of request"){
                                    pendingBuilder[result.display.split(': ')[0]] = new Date(result.display.split(': ')[1].split(' IST')[0])
                                } 
                            }
                        })
                        pendingBuilder["Cross Match Form"] = {}
                        pendingBuilder["TB Request Form"] = {}
                        pendingBuilder["FNAC Form"] = {}
                        pendingBuilder["Peripheral Morphology Form"] = {}
                        pendingBuilder["Cross Match Form"].pending =(pendingBuilder["bt, dr Confirmed and signed: true"] && !pendingBuilder["bt, lb Confirmed and signed: true"]) || (pendingBuilder["bt, dr Confirmed and signed: true"] > pendingBuilder["bt, lb Confirmed and signed: true"])
                        pendingBuilder["TB Request Form"].pending =(pendingBuilder["tbrf, dr confirmed: true"] && !pendingBuilder["tbrf, lb confirmed: true"]) || (pendingBuilder["tbrf, dr confirmed: true"] > pendingBuilder["tbrf, lb confirmed: true"])  
                        pendingBuilder["FNAC Form"].pending =(pendingBuilder["fnacrf, dr confirmed: true"] && !pendingBuilder["fnacrf, lb Confirmed and signed: true"]) || (pendingBuilder["fnacrf, dr confirmed: true"] > pendingBuilder["fnacrf, lb Confirmed and signed: true"])          
                        pendingBuilder["Peripheral Morphology Form"].pending =(pendingBuilder["pmorphrf, dr Confirmed and signed: true"] && !pendingBuilder["pmorphrf, lb Confirmed and signed: true"]) || (pendingBuilder["pmorphrf, dr Confirmed and signed: true"] > pendingBuilder["pmorphrf, lb Confirmed and signed: true"])          
                        pendingBuilder["Cross Match Form"].results = pendingBuilder["bt, lb Confirmed and signed: true"] != undefined
                        pendingBuilder["TB Request Form"].results = pendingBuilder["tbrf, lb confirmed: true"] != undefined
                        pendingBuilder["FNAC Form"].results = pendingBuilder["fnacrf, lb Confirmed and signed: true"] != undefined
                        pendingBuilder["Peripheral Morphology Form"].results = pendingBuilder["pmorphrf, lb Confirmed and signed: true"] != undefined
                        $scope.patient.testDate = pendingBuilder["tbrf, dr confirmed: true"]
                        $scope.allTemplates.forEach(element => {
                            if(element.conceptName == "Cross Match Form"){
                                element.alwaysShow = !pendingBuilder["Cross Match Form"].pending  
                            }
                            else if(element.conceptName == "tbrf, TB Request Form"){
                                element.alwaysShow = !pendingBuilder["TB Request Form"].pending  
                            }
                            else if(element.conceptName == "FNAC request form"){
                                element.alwaysShow = !pendingBuilder["FNAC Form"].pending  
                            }
                            else if(element.conceptName == "Peripheral morphology request form"){
                                element.alwaysShow = !pendingBuilder["Peripheral Morphology Form"].pending  
                            }
                            else if(element.conceptName == "Pending Orders"){
                                element.alwaysShow = pendingBuilder["Cross Match Form"].pending || pendingBuilder["TB Request Form"].pending || pendingBuilder["FNAC Form"].pending || pendingBuilder["Peripheral Morphology Form"].pending
                                element.pendingOrders = pendingBuilder
                            }
                            else if(element.conceptName == "Results"){
                                element.alwaysShow = pendingBuilder["Cross Match Form"].results
                            }
                            else if(element.conceptName == "Results 2"){
                                element.alwaysShow = pendingBuilder["TB Request Form"].results
                            }
                            else if(element.conceptName == "Result 3"){
                                element.alwaysShow = pendingBuilder["FNAC Form"].results
                            }
                            else if(element.conceptName == "Results 4"){
                                element.alwaysShow = pendingBuilder["Peripheral Morphology Form"].results
                            }
                            else{
                                element.alwaysShow = true
                            }
                        });

                        $scope.consultation.selectedObsTemplate = _.filter($scope.allTemplates, function (template) {
                            return template.alwaysShow;
                        });

                        openTemplate(_.first($scope.consultation.selectedObsTemplate));
                    })
                    
                }
                
                
            };


            $scope.filterTemplates = function () {
                $scope.uniqueTemplates = _.uniqBy($scope.allTemplates, 'label');
                if ($scope.consultation.searchParameter) {
                    $scope.uniqueTemplates = _.filter($scope.uniqueTemplates, function (template) {
                        return _.includes(template.label.toLowerCase(), $scope.consultation.searchParameter.toLowerCase());
                    });
                }
                return $scope.uniqueTemplates;
            };

            var showOnlyTemplatesFilledInProgram = function () {
                spinner.forPromise(conceptSetService.getObsTemplatesForProgram($state.params.programUuid).success(function (data) {
                    if (data.results.length > 0 && data.results[0].mappings.length > 0) {
                        _.map(allConceptSections, function (conceptSection) {
                            conceptSection.isAdded = false;
                            conceptSection.alwaysShow = false;
                        });

                        _.map(data.results[0].mappings, function (template) {
                            var matchedTemplate = _.find(allConceptSections, {uuid: template.uuid});
                            if (matchedTemplate) {
                                matchedTemplate.alwaysShow = true;
                            }
                        });
                    }
                }));
            };

            var createConceptSections = function (allTemplates) {
                _.map(allTemplates, function (template) {
                    if(template){
                    var conceptSetExtension = _.find(extensions, function (extension) {
                        return extension.extensionParams.conceptName === template.name.name;
                    }) || {};
                    var conceptSetConfig = configs[template.name.name] || {};
                    var observationsForTemplate = getObservationsForTemplate(template);
                    if (observationsForTemplate && observationsForTemplate.length > 0) {
                        _.each(observationsForTemplate, function (observation) {
                            allConceptSections.push(new Bahmni.ConceptSet.ConceptSetSection(conceptSetExtension, $rootScope.currentUser, conceptSetConfig, [observation], template));
                        });
                    } else {
                        allConceptSections.push(new Bahmni.ConceptSet.ConceptSetSection(conceptSetExtension, $rootScope.currentUser, conceptSetConfig, [], template));
                    }}
                });
            };

            var collectObservationsFromConceptSets = function () {
                $scope.consultation.observations = [];
                _.each($scope.consultation.selectedObsTemplate, function (conceptSetSection) {
                    if (conceptSetSection.observations[0]) {
                        $scope.consultation.observations.push(conceptSetSection.observations[0]);
                    }
                });
                _.each($scope.availableConceptSets, function (conceptSetSection) {
                    if (conceptSetSection.observations[0]) {
                        $scope.consultation.observations.push(conceptSetSection.observations[0]);
                    }
                });
            };
            
            var getObservationsForTemplate = function (template) {
                return _.filter($scope.consultation.observations, function (observation) {
                    return !observation.formFieldPath && observation.concept.uuid === template.uuid;
                });
            };

            var getSelectedObsTemplate = function (allConceptSections) {
                return allConceptSections.filter(function (conceptSet) {
                    if (conceptSet.isAvailable($scope.context)) {
                        return true;
                    }
                });
            };

            $scope.stopAutoClose = function ($event) {
                $event.stopPropagation();
            };

            $scope.addTemplate = function (template) {
                $scope.scrollingEnabled = true;
                $scope.showTemplatesList = false;
                var index = _.findLastIndex($scope.consultation.selectedObsTemplate, function (consultationTemplate) {
                    return consultationTemplate.label == template.label;
                });

                if (index != -1 && $scope.consultation.selectedObsTemplate[index].allowAddMore) {
                    var clonedObj = template.clone();
                    clonedObj.klass = "active";
                    $scope.consultation.selectedObsTemplate.splice(index + 1, 0, clonedObj);
                } else {
                    template.toggle();
                    template.klass = "active";
                    if (index > -1) {
                        $scope.consultation.selectedObsTemplate[index] = template;
                    } else {
                        $scope.consultation.selectedObsTemplate.push(template);
                    }
                }
                $scope.consultation.searchParameter = "";
                messagingService.showMessage("info", $translate.instant("CLINICAL_TEMPLATE_ADDED_SUCCESS_KEY", {label: template.label}));
            };

            $scope.getNormalized = function (conceptName) {
                return conceptName.replace(/['\.\s\(\)\/,\\]+/g, "_");
            };

            $scope.consultation.preSaveHandler.register("collectObservationsFromConceptSets", collectObservationsFromConceptSets);
            // Form Code :: Start
            var getObservationForms = function (observationsForms) {
                var forms = [];
                var observations = $scope.consultation.observations || [];
                _.each(observationsForms, function (observationForm) {
                    var formUuid = observationForm.formUuid || observationForm.uuid;
                    var formName = observationForm.name || observationForm.formName;
                    var formVersion = observationForm.version || observationForm.formVersion;
                    var privileges = observationForm.privileges;
                    var labels = observationForm.nameTranslation ? JSON.parse(observationForm.nameTranslation) : [];
                    var label = formName;
                    if (labels.length > 0) {
                        var locale = localStorage.getItem("NG_TRANSLATE_LANG_KEY") || "en";
                        var currentLabel = labels.find(function (label) {
                            return label.locale === locale;
                        });
                        if (currentLabel) { label = currentLabel.display; }
                    }
                    if ($scope.isFormEditableByTheUser(observationForm)) {
                        var newForm = new Bahmni.ObservationForm(formUuid, $rootScope.currentUser,
                                                                   formName, formVersion, observations, label);
                        newForm.privileges = privileges;
                        forms.push(newForm);
                    }
                });

                return forms;
            };
            $scope.isFormEditableByTheUser = function (form) {
                var result = false;
                if ((typeof form.privileges != 'undefined') && (form.privileges != null) && (form.privileges.length != 0)) {
                    form.privileges.forEach(function (formPrivilege) {
                        _.find($rootScope.currentUser.privileges, function (privilege) {
                            if (formPrivilege.privilegeName === privilege.name) {
                                if (formPrivilege.editable) {
                                    result = formPrivilege.editable;
                                } else {
                                    if (formPrivilege.viewable) {
                                        result = true;
                                    }
                                }
                            }
                        });
                    });
                } else { result = true; }
                return result;
            };

            // Form Code :: End
            preInit();
        }]);
