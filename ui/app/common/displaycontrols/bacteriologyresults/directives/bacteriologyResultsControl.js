'use strict';

angular.module('bahmni.common.displaycontrol.bacteriologyresults')
    .directive('bacteriologyResultsControl', ['bacteriologyResultsService', 'appService', '$q', 'spinner', '$filter', 'ngDialog',
        'bacteriologyTabInitialization', '$controller', 'consultationInitialization', 'messagingService', '$rootScope', '$translate',
        'encounterService', 'observationsService', 'auditLogService', '$state', '$http',
        function (bacteriologyResultsService, appService, $q, spinner, $filter, ngDialog, bacteriologyTabInitialization, $controller,
                  consultationInitialization, messagingService, $rootScope, $translate, encounterService, observationsService, auditLogService, $state, $http) {
            var controller = function ($scope) {
                var shouldPromptBeforeClose = true;

                var expandAllSpecimensIfDashboardIsBeingPrinted = function () {
                    if ($rootScope.isBeingPrinted) {
                        _.each($scope.specimens, function (specimen) {
                            specimen.isOpen = true;
                        });
                    }
                };

                var init = function () {
                    $scope.title = "bacteriology results";
                    var params = {
                        patientUuid: $scope.patient.uuid,
                        patientProgramUuid: $scope.enrollment
                    };
                    $scope.initializationPromise = bacteriologyTabInitialization().then(function (data) {
                        $scope.bacteriologyTabData = data;
                        bacteriologyResultsService.getBacteriologyResults(params).then(function (response) {
                            handleResponse(response);
                            expandAllSpecimensIfDashboardIsBeingPrinted();
                        });
                    });
                    return $scope.initializationPromise;
                };

                $scope.specialOrderOrderables = [];

                var isCancelledIdentifier = function (identifier) {
                        var normalized = (identifier || "").toString().toLowerCase().trim();
                        return normalized.indexOf("cancelled") === 0 || normalized.indexOf("order cancelled") === 0;
                };
                
                var handleResponse = function (response) {
                    $scope.observations = response.data.results;
                    if ($scope.observations && $scope.observations.length > 0) {
                        $scope.specimens = [];
                        var sampleSource = _.find($scope.bacteriologyTabData.setMembers, function (member) {
                            return member.name.name === Bahmni.Clinical.Constants.bacteriologyConstants.specimenSampleSourceConceptName;
                        });
                        $scope.allSamples = sampleSource != undefined && _.map(sampleSource.answers, function (answer) {
                            return new Bahmni.Common.Domain.ConceptMapper().map(answer);
                        });
                        var specimenMapper = new Bahmni.Clinical.SpecimenMapper();
                        var conceptsConfig = appService.getAppDescriptor().getConfigValue("conceptSetUI") || {};
                        var dontSortByObsDateTime = true;
                        _.forEach($scope.observations, function (observation) {
                            var mappedSpecimen = specimenMapper.mapObservationToSpecimen(observation, $scope.allSamples, conceptsConfig, dontSortByObsDateTime);
                            if (mappedSpecimen.cancelled || isCancelledIdentifier(mappedSpecimen.identifier) || isCancelledIdentifier(mappedSpecimen.specimenId)) {
                                mappedSpecimen.cancelled = true;
                                var persistedCancelledText = mappedSpecimen.identifier || mappedSpecimen.specimenId || "Cancelled";
                                mappedSpecimen.identifier = persistedCancelledText;
                                mappedSpecimen.specimenId = persistedCancelledText;
                            }
                            mappedSpecimen.cancellationReason = mappedSpecimen.cancellationReason || observation.comment || observation.voidedReason;
                            $scope.specimens.push(mappedSpecimen);
                        });
                    } else {
                        $scope.specimens = [];
                    }

                    $scope.isDataPresent = function () {
                        if (!$scope.specimens || !$scope.specimens.length) {
                            return $scope.$emit("no-data-present-event") && false;
                        }
                        return true;
                    };
                };


                var createOrdersFromObs = function(encounterData){

                    const results = [];
                    const specimens = encounterData?.extensions?.mdrtbSpecimen;

                    if (!Array.isArray(specimens)) return results;

                    specimens.forEach((specimen, specimenIndex) => {
                        // Cancelled/voided specimens should not generate new orders.
                        if (specimen?.voided || specimen?.cancelled || isCancelledIdentifier(specimen?.identifier)) {
                            return;
                        }

                        if (specimen?.orderCategory === "Pathology") {

                            const additionalAttributes = specimen?.sample?.additionalAttributes;
                            if (!additionalAttributes) return;

                            const level1Members = additionalAttributes?.groupMembers;
                            if (!Array.isArray(level1Members)) return;

                            level1Members.forEach((level1Obs) => {

                                const level2Members = level1Obs?.groupMembers;
                                if (!Array.isArray(level2Members)) return;

                                level2Members.forEach((obs) => {
                                    const val = obs?.value;

                                    if (val === undefined || val === null) return;
                                    if (typeof val !== "object") return;

                                    if (!val.uuid) return;

                                    results.push(val.uuid);
                                });
                            });

                        }
                        else if (specimen?.orderCategory === "Microbiology Order") {
                            results.push(specimen?.type?.uuid)
                        }

                    });

                    return results;
                }


                var getSpecialOrderUuid = function () {
                    var params = {
                        q: "bahmni.sqlGet.getSpecialOrders"
                    };
                    return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                        method: "GET",
                        params: params,
                        withCredentials: true
                    });
                };

                getSpecialOrderUuid().then(function (response) {
                    $scope.specialOrderOrderables = response.data.map(e => e.uuid);
                })

                $scope.editBacteriologySample = function (specimen) {
                    var configForPrompt = appService.getAppDescriptor().getConfigValue('showSaveConfirmDialog');
                    $scope.editDialogInitializationPromise = consultationInitialization($scope.patient.uuid, null, null).then(function (consultationContext) {
                        $scope.consultation = consultationContext;
                        $scope.consultation.newlyAddedSpecimens = [];

                        $scope.isOnDashboard = true;
                        $scope.consultation.newlyAddedSpecimens.push(specimen);
                        $scope.dialogElement = ngDialog.open({
                            template: '../common/displaycontrols/bacteriologyresults/views/editBacteriologySample.html',
                            scope: $scope,
                            className: "ngdialog-theme-default ng-dialog-all-details-page ng-dialog-edit",
                            controller: $controller('BacteriologyController', {
                                $scope: $scope,
                                bacteriologyConceptSet: $scope.bacteriologyTabData
                            }),
                            preCloseCallback: function () {
                                if (configForPrompt && shouldPromptBeforeClose) {
                                    if (confirm($translate.instant("POP_UP_CLOSE_DIALOG_MESSAGE_KEY"))) {
                                        if (!$rootScope.hasVisitedConsultation) {
                                            window.onbeforeunload = null;
                                        }

                                        init();
                                        return true;
                                    }
                                    return false;
                                } else {
                                    init();
                                }
                            }
                        });
                        $scope.scrollOnEdit = "scrollOnEdit";
                    });
                };

                $scope.hasCollectSamplePrivilege = function () {
                    return _.find($rootScope.currentUser.privileges, function (privilege) {
                        return privilege.name === 'Collect Sample';
                    });
                }; 

                $scope.cancelBacteriologySample = function (specimen) {
                    if (!specimen || specimen.voided || specimen.cancelled) {
                        return;
                    }
                    if (specimen.identifier) {
                        messagingService.showMessage('error', 'Collected samples cannot be cancelled');
                        return;
                    }
                    specimen.showCancelReasonInput = true;
                    specimen.cancelReasonDraft = specimen.cancelReasonDraft || "";
                };

                $scope.abortCancelBacteriologySample = function (specimen) {
                    if (!specimen) {
                        return;
                    }
                    specimen.showCancelReasonInput = false;
                    specimen.cancelReasonDraft = "";
                };

                $scope.confirmCancelBacteriologySample = function (specimen) {
                    if (!specimen) {
                        return;
                    }
                    var reason = (specimen.cancelReasonDraft || "").trim();
                    if (!reason) {
                        messagingService.showMessage('error', 'Cancellation reason is required');
                        return;
                    }

                    specimen.cancelled = true;
                    specimen.cancellationReason = reason;
                    specimen.voided = false;
                    specimen.voidedReason = null;
                    // Persist cancelled state + reason on the same field path used by "Collected",
                    // so it survives reloads and is visible in the summary row.
                    specimen.identifier = "Cancelled: " + reason;
                    specimen.showCancelReasonInput = false;
                    specimen.cancelReasonDraft = "";
                    specimen.collectionLabel = 'ORDER CANCELLED';

                    $scope.saveBacteriologySample(specimen);
                };

                $scope.saveBacteriologySample = function (specimen) {
                    specimen.hasIllegalDateCollected = !specimen.dateCollected;
                    specimen.hasIllegalType = !specimen.type;
                    specimen.hasIllegalTypeFreeText = !specimen.typeFreeText;
                    if (!specimen?.voided && !specimen?.cancelled && specimen.isDirty()) {
                        messagingService.showMessage('error', "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                    } else {
                        shouldPromptBeforeClose = false;
                        var specimenMapper = new Bahmni.Clinical.SpecimenMapper();
                        specimen.voidIfEmpty();

                        observationsService.getByUuid(specimen.existingObs).then(function (response) {
                            encounterService.findByEncounterUuid(response.data.encounterUuid).then(function (response) {
                                $scope.encounter = response.data;
                                $scope.encounter.orders = []
                                $scope.encounter.observations = [];
                                $scope.encounter.extensions = {mdrtbSpecimen: [specimenMapper.mapSpecimenToObservation(specimen)]};
                                if($scope.hasCollectSamplePrivilege()?.name === 'Collect Sample'){ 
                                        const uuids = createOrdersFromObs($scope.encounter)
                                        const matches = uuids.filter(uuid =>
                                            $scope.specialOrderOrderables.includes(uuid)
                                        );
                                        if (matches.length > 0) {
                                            const specialOrders = {
                                                commentToFulfiller: undefined,
                                                concept: {
                                                    name: undefined,
                                                    uuid: matches[0]
                                                },
                                                urgency: undefined,
                                                uuid: undefined
                                            };
                                            $scope.encounter.orders.push(specialOrders);
                                        }
                                }
                                var createPromise = encounterService.create($scope.encounter);
                                spinner.forPromise(createPromise).then(function (savedResponse) {
                                    var messageParams = {
                                        encounterUuid: savedResponse.data.encounterUuid,
                                        encounterType: savedResponse.data.encounterType
                                    };
                                    auditLogService.log($scope.patient.uuid, "EDIT_ENCOUNTER", messageParams, "MODULE_LABEL_CLINICAL_KEY");
                                    if (!$rootScope.hasVisitedConsultation) {
                                        window.onbeforeunload = null;
                                    }
                                    $rootScope.hasVisitedConsultation = false;
                                    $state.go($state.current, {}, {reload: true});
                                    ngDialog.close();
                                    messagingService.showMessage('info', "{{'CLINICAL_SAVE_SUCCESS_MESSAGE_KEY' | translate}}");
                                });
                            });
                        });
                    }
                };

                $scope.getDisplayName = function (specimen) {
                    var type = specimen.type;
                    var displayName = type.shortName ? type.shortName : type.name;
                    if (displayName === Bahmni.Clinical.Constants.bacteriologyConstants.otherSampleType) {
                        displayName = specimen.typeFreeText;
                    }
                    return displayName;
                };

                $scope.hasResults = function (test) {
                    return test && test.groupMembers;
                };

                init();
            };

            var link = function ($scope, element) {
                $scope.$watch('initializationPromise', function () {
                    $scope.initializationPromise && spinner.forPromise($scope.initializationPromise, element);
                });
                $scope.$watch('editDialogInitializationPromise', function () {
                    $scope.editDialogInitializationPromise && spinner.forPromise($scope.editDialogInitializationPromise, element);
                });
                $scope.$watch('saveBacteriologyResultsPromise', function () {
                    $scope.saveBacteriologyResultsPromise && spinner.forPromise($scope.saveBacteriologyResultsPromise, $('#' + $scope.dialogElement.id));
                });
            };

            return {
                restrict: 'E',
                controller: controller,
                templateUrl: "../common/displaycontrols/bacteriologyresults/views/bacteriologyResultsControl.html",
                scope: {
                    patient: "=",
                    section: "=",
                    observationUuid: "=",
                    config: "=",
                    visitUuid: "=",
                    enrollment: "@"
                },
                link: link
            };
        }]);
