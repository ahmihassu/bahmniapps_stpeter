'use strict';

angular.module('bahmni.common.displaycontrol.forms')
    .directive('formsTable', ['conceptSetService', 'spinner', '$q', 'visitFormService', 'appService', '$state', '$rootScope', 'clinicalDashboardConfig',
        function (conceptSetService, spinner, $q, visitFormService, appService, $state, $rootScope, $clinicalDashboardConfig) {
            var defaultController = function ($scope) {
                $scope.shouldPromptBrowserReload = true;
                $scope.showFormsDate = appService.getAppDescriptor().getConfigValue("showFormsDate");
                var getAllObservationTemplates = function () {
                    return conceptSetService.getConcept({
                        name: "All Observation Templates",
                        v: "custom:(setMembers:(display))"
                    });
                };
                var getDrugChart = function () {
                    return conceptSetService.getConcept({
                        name: "Drug Chart",
                        v: "full"
                    });
                };
                var obsFormData = function () {
                    return visitFormService.formData($scope.patient.uuid, $scope.section.dashboardConfig.maximumNoOfVisits, $scope.section.formGroup, $state.params.enrollment);
                };

                var filterFormData = function (formData) {
                    var filterList = [];
                    _.each(formData, function (item) {
                        var foundElement = _.find(filterList, function (filteredItem) {
                            return item.concept.uuid == filteredItem.concept.uuid;
                        });
                        if (foundElement == undefined) {
                            filterList.push(item);
                        }
                    });
                    return filterList;
                };

                var filterDrugChart = function (drugChartConceptUuid,formData) {
                        
                    formData = formData.filter(function (item) {
                        return item.concept.uuid !== drugChartConceptUuid;
                    });
                   
                    return formData;
                }

                var sortedFormDataByLatestDate = function (formData) {
                    return _.sortBy(formData, "obsDatetime").reverse();
                };
                $scope.doesUserHaveAccessToTheForm = function (data, action) {
                    if ((data.privileges != null) && (typeof data.privileges != undefined) && (data.privileges > 0)) {
                        var editable = [];
                        var viewable = [];
                        data.privileges.forEach(function (formPrivilege) {
                            _.find($rootScope.currentUser.privileges, function (privilege) {
                                if (formPrivilege.privilegeName === privilege.name) {
                                    if (action === 'edit') {
                                        editable.push(formPrivilege.editable);
                                    } else {
                                        viewable.push(formPrivilege.viewable);
                                    }
                                }
                            });
                        });
                        if (action === 'edit') {
                            if (editable.includes(true)) {
                                return true;
                            }
                        } else {
                            if (viewable.includes(true)) {
                                return true;
                            }
                        }
                    } else { return true; }
                };
                var init = function () {
                    $scope.formsNotFound = false;
                    return $q.all([getAllObservationTemplates(), obsFormData(),getDrugChart()]).then(function (results) {
                        $scope.observationTemplates = results[0].data.results[0].setMembers;
                        var drugChartConceptUuid = results[2].data.results[0].uuid;
                        var sortedFormDataByDate = sortedFormDataByLatestDate(results[1].data.results);
                        if ($scope.isOnDashboard) {
                            var filteredFormData = filterFormData(sortedFormDataByDate);
                            $scope.formData = filterDrugChart(drugChartConceptUuid,filteredFormData);
                        } else {
                            $scope.formData = filterDrugChart(drugChartConceptUuid,sortedFormDataByDate);
                        }

                        if ($scope.formData.length === 0) {
                            $scope.formsNotFound = true;
                            $scope.$emit("no-data-present-event");
                        }
                    });
                };

                $scope.printForm = function (form, formDate){
                    var params = $clinicalDashboardConfig.currentTab.sections["treatments"].expandedViewConfig;
                    var treatmentConfig = {};
                    var patientUuidparams = {"patientUuid": form.patient.uuid};
                    _.extend(treatmentConfig, params, patientUuidparams);

                    var diagnosisConfig = $clinicalDashboardConfig.currentTab.sections["diagnosis"];

                    // var dispositionConfig = $clinicalDashboardConfig.currentTab.sections["disposition"];

                    var investigationConfig = $clinicalDashboardConfig.currentTab.sections["labResults"].expandedViewConfig;
                    investigationConfig.patientUuid = form.patient.uuid;
                    investigationConfig.showChart = false;

                    $rootScope.$broadcast("event:printForm", {title: form.section.title,
                        patient: form.patient,
                        formConfig: form.config,
                        formDate: formDate,
                        treatmentConfig: treatmentConfig,
                        diagnosisConfig: diagnosisConfig,
                        investigationConfig: investigationConfig});
                }

                $scope.getDisplayName = function (data) {
                    var concept = data.concept;
                    var defaultLocale = $rootScope.currentUser.userProperties.defaultLocale;
                    var displayName = getLocaleSpecificConceptName(concept, defaultLocale, "FULLY_SPECIFIED");
                    return displayName;
                };
                var getLocaleSpecificConceptName = function (concept, locale, conceptNameType) {
                    conceptNameType = conceptNameType ? conceptNameType : "SHORT";
                    var localeSpecificName = _.filter(concept.names, function (name) {
                        return ((name.locale === locale) && (name.conceptNameType === conceptNameType));
                    });
                    if (localeSpecificName && localeSpecificName[0]) {
                        return localeSpecificName[0].display;
                    }
                    return concept.name.name;
                };

                $scope.initialization = init();

                $scope.getEditObsData = function (observation) {
                    return {
                        observation: observation,
                        conceptSetName: observation.concept.displayString,
                        conceptDisplayName: $scope.getDisplayName(observation)
                    };
                };
                $scope.shouldPromptBeforeClose = true;

                $scope.editable = function (data) {
                    var editable = ["Vitals", "PACU Vital Sign Sheet", "Post Anesthesia Care Unit Vital Sign Sheet", "Postpartum Follow up", "PPH PPH-Follow Up Sheet", "Pre OP Vital Sign", "PREANESTHETIC EVALUATION FORM", 
                        "Preclampsia and eclampsia chart", "Premature Vital Sign", "OR Instrumental Count", "Present pregnancy follow up schedule of ANC contacts", "PROM Follow up Sheet", "PS Progress/Follow-up Sheet", "Psychiatry History", "WHO Surgical Safety Checklist", 
                        "Vital Sign", "TTI Immunization", "Vital Sign for 0-5 months", "Vital Sign For Adolescents (above 12)", "Vital Sign for Infants", "Vital Sign for Neonates", "Vital Sign for Pre School children (3-6)", 
                        "Vital Sign for School-age (6-12)", "Vital Sign for Toddlers (1-3yrs)", "Cardiac Clinic Follow up Form - Acquired Heart Disease", "Cardiac Clinic Follow up Form - Congenital Heart Disease", "DKA Follow up Sheet",
                        "Medical ICU Fluid Balance (Input Output) Record Sheet", "Infant Immunization Card", "Integrated Antenatal, Labor, Delivery, Newborn and post natal care card Form", "Medication Administration Sheet", "Midwives Vital Sign Sheet", 
                        "Nursing and Midwife Comprehensive Assessment Clinical Data", "Nursing and Midwifery Comprehensive Assessment format; Section 2", "Nursing and Midwifery Comprehensive Client Assessment format Section 1", 
                        "Nursing and Midwifery Comprehensive Client Assessment format Section 3; Activity Exercise Pattern", "Nursing/ Midwife Comprehensive Client Assessment Format; Section 4", "Nursing/ Midwife Comprehensive Client Assessment Format; Section 5", 
                        "Nursing/ Midwife Progress note", "Nursing/ Midwifery Activity Sheet", "Ophthalmology history and Physical Examination", "PICU Medication Administration Sheet", "Psychiatry Follow-up form", "National Blood Bank Services Blood Transfusion Follow Up Form", 
                        "APH Follow up Form", "Nursing/ Midwifery Problem Index List", "Implementation Notes", "Investigation Summary Sheet", "Salbutamol challenge follow up chart", "NEUROSIGN CHART", "Diabetic patient follow up sheet", "Blood Transfusion Follow Up Sheet", 
                        "Medication Reconciliation Form", "In-patient Medication Profile Form", "ICU patient monitoring sheet", "Anesthesia record sheet", "MAGNESIUM SULFATE MONITORING SHEET", "Induction/ augmentation follow up chart", 
                        "Intrapartum Care and follow-up; Monitoring Progress Of labor Using Partograph", "Referral Clinics Follow up Sheet", "Psychiatry Progress/ follow up sheet" , "Implementation Form"];
                    var name = $scope.getDisplayName(data)
                    if (editable.includes(name)){
                        return true
                    } 
                    else return false               
                }

                $scope.getConfigToFetchDataAndShow = function (data) {
                    return {
                        patient: $scope.patient,
                        config: {
                            conceptNames: [data.concept.displayString],
                            showGroupDateTime: false,
                            encounterUuid: data.encounterUuid,
                            observationUuid: data.uuid,
                            showDetailsButton: true
                        },
                        section: {
                            title: data.concept.displayString
                        }
                    };
                };

                $scope.dialogData = {
                    "patient": $scope.patient,
                    "section": $scope.section
                };
            };

            var link = function ($scope, element) {
                spinner.forPromise($scope.initialization, element);
            };

            return {
                restrict: 'E',
                controller: function ($scope, $controller) {
                    if ($scope.section.type && $scope.section.type === Bahmni.Common.Constants.formBuilderDisplayControlType) {
                        return $controller("versionedFormController", {$scope: $scope});
                    }
                    return defaultController($scope);
                },
                link: link,
                templateUrl: "../common/displaycontrols/forms/views/formsTable.html",
                scope: {
                    section: "=",
                    patient: "=",
                    isOnDashboard: "="
                }
            };
        }
    ]);

