"use strict";

angular.module('bahmni.ipd')
    .controller('AdtController', ['$scope', '$q', '$rootScope', 'spinner', 'dispositionService', '$http',
        'encounterService', 'bedService', 'appService', 'visitService', '$location', '$window', 'sessionService',
        'messagingService', 'bedStatusService' ,'$anchorScroll', '$stateParams', 'ngDialog', '$filter', '$state',
        function ($scope, $q, $rootScope, spinner, dispositionService, $http, encounterService, bedService,
                  appService, visitService, $location, $window, sessionService, messagingService, bedStatusService ,$anchorScroll,
                  $stateParams, ngDialog, $filter, $state) {
            var actionConfigs = {};
            var encounterConfig = $rootScope.encounterConfig;
            var locationUuid = sessionService.getLoginLocationUuid();
            var visitTypes = encounterConfig.getVisitTypes();
            var customVisitParams = Bahmni.IPD.Constants.visitRepresentation;
            $scope.assignBedsPrivilege = Bahmni.IPD.Constants.assignBedsPrivilege;
            $scope.defaultVisitTypeName = appService.getAppDescriptor().getConfigValue('defaultVisitType');
            var hideStartNewVisitPopUp = appService.getAppDescriptor().getConfigValue('hideStartNewVisitPopUp');
            $scope.adtObservations = [];
            $scope.dashboardConfig = appService.getAppDescriptor().getConfigValue('dashboard');
            $scope.expectedDateOfDischargeConceptName = appService.getAppDescriptor().getConfigValue('expectedDateOfDischarge') || "";
            $scope.getAdtConceptConfig = $scope.dashboardConfig.conceptName;
            $scope.editMode = false;
            $scope.isCurrentVisitMedicoLegal = false;
            $scope.adt = {};
            $scope.hasDeposit = false;

            var getVisitTypeUuid = function (visitTypeName) {
                var visitType = _.find(visitTypes, {name: visitTypeName});
                return (visitType && visitType.uuid) || null;
            };

            var defaultVisitTypeUuid = getVisitTypeUuid($scope.defaultVisitTypeName);

            var getCurrentVisitTypeUuid = function () {
                if ($scope.visitSummary && $scope.visitSummary.dateCompleted === null) {
                    return getVisitTypeUuid($scope.visitSummary.visitType);
                }
                return defaultVisitTypeUuid;
            };

            var initializeActionConfig = function () {
                var admitActions = appService.getAppDescriptor().getExtensions("org.bahmni.ipd.admit.action", "config");
                var transferActions = appService.getAppDescriptor().getExtensions("org.bahmni.ipd.transfer.action", "config");
                var dischargeActions = appService.getAppDescriptor().getExtensions("org.bahmni.ipd.discharge.action", "config");
                var undoDischargeActions = appService.getAppDescriptor().getExtensions("org.bahmni.ipd.undo.discharge.action", "config");
                if (encounterConfig) {
                    var Constants = Bahmni.Common.Constants;
                    actionConfigs[Constants.admissionCode] = {
                        encounterTypeUuid: encounterConfig.getAdmissionEncounterTypeUuid(),
                        allowedActions: admitActions
                    };
                    actionConfigs[Constants.dischargeCode] = {
                        encounterTypeUuid: encounterConfig.getDischargeEncounterTypeUuid(),
                        allowedActions: dischargeActions
                    };
                    actionConfigs[Constants.transferCode] = {
                        encounterTypeUuid: encounterConfig.getTransferEncounterTypeUuid(),
                        allowedActions: transferActions
                    };
                    actionConfigs[Constants.undoDischargeCode] = {
                        encounterTypeUuid: encounterConfig.getDischargeEncounterTypeUuid(),
                        allowedActions: undoDischargeActions
                    };
                }
            };

            var filterAction = function (actions, actionTypes) {
                return _.filter(actions, function (action) {
                    return actionTypes.indexOf(action.name.name) >= 0;
                });
            };

            var getDispositionActions = function (actions) {
                var visitSummary = $scope.visitSummary;
                var stopDate = visitSummary && visitSummary.stopDateTime;
                var isVisitOpen = (stopDate === null);
                if (visitSummary && visitSummary.isDischarged() && isVisitOpen) {
                    return filterAction(actions, ["Undo Discharge"]);
                } else if (visitSummary && visitSummary.isAdmitted() && isVisitOpen) {
                    return filterAction(actions, ["Transfer Patient", "Discharge Patient"]);
                } else {
                    return filterAction(actions, ["Admit Patient"]);
                }
            };

            var getLastActiveVisitFromSearch = function (response) {
                var results = response.data.results || [];
                return results.length ? _.last(results) : null;
            };

            var isMedicoLegalVisitByAttributes = function (visit) {
                var attributes = visit && visit.attributes;
                if (!attributes || !attributes.length) {
                    return false;
                }
                return _.some(attributes, function (attr) {
                    var d = attr && attr.display ? String(attr.display).trim() : '';
                    return /^Medico Legal Cases?:\s*true\s*$/i.test(d);
                });
            };

            var getPatientSpecificActiveVisits = function (response) {
                var currentActiveVisit = getLastActiveVisitFromSearch(response);
                return currentActiveVisit ? currentActiveVisit.uuid : null;
            };

            var getVisit = function () {
                var getNoVisitPromise = function () {
                    $scope.visitSummary = null;
                    $scope.isCurrentVisitMedicoLegal = false;
                    return $q.when({id: 1, status: "Returned from service.", promiseComplete: true});
                };
                if ($scope.patient) {
                    return visitService.search({patient: $scope.patient.uuid, v: customVisitParams, includeInactive: false}).then(function (visitsResponse) {
                        var currentActiveVisit = getLastActiveVisitFromSearch(visitsResponse);
                        $scope.isCurrentVisitMedicoLegal = isMedicoLegalVisitByAttributes(currentActiveVisit);
                        var visitUuid = currentActiveVisit ? currentActiveVisit.uuid : null;
                        if (visitUuid) {
                            return visitService.getVisitSummary(visitUuid).then(function (response) {
                                $scope.visitSummary = new Bahmni.Common.VisitSummary(response.data);
                                getDischargeStatus($scope.patient.uuid);
                            });
                        } else {
                            return getNoVisitPromise();
                        }
                    });
                } else {
                    return getNoVisitPromise();
                }
            };

            var formData = function (patientUuid, numberOfVisits, formGroup, patientProgramUuid) {
                var params = {
                    s: "byPatientUuid",
                    patient: patientUuid,
                    numberOfVisits: numberOfVisits,
                    v: "visitFormDetails",
                    conceptNames: formGroup || null,
                    patientProgramUuid: patientProgramUuid || null
                };
                return $http.get(Bahmni.Common.Constants.formDataUrl, {params: params});
            };

            var getDischargeStatus = function(patientUuid){
                formData(patientUuid, 1, ["Disposition"]).then(function(response){
                    $scope.canBeDischarged = response.data.results.length > 0 && response.data.results[0].display.toLowerCase().includes("discharge")
                });
            }

            var extractWard = function() {
                if($scope.patient){
                dispositionService.getDispositionByPatient($scope.patient.uuid,1).then(function(respons){    
                    var unregister = $scope.$watch('respons', function () {
                        
                        if(respons.data[0]){
                            if(respons.data[0].additionalObs[0]){
                                $scope.dispositionNoteValue = respons.data[0].additionalObs[0].value;
                                try
                                {   
                                    var wardName = $scope.dispositionNoteValue.split(": ")[1];
                                    if(wardName.length>0){
                                        $scope.$on('admitSelected',$rootScope.$broadcast('admitSelected',wardName))
                                        console.log(wardName);
                                    }
                                }
                                catch(err){//console.log(err);
                                }      
                            }
                        }

                        unregister();
                        
                    });
                })
            }
            }

            extractWard();

            $scope.showAdtButtons = function () {
                return $state.current.name === "bedManagement.patient" && !$scope.editMode;
            };

            $scope.checkPrivilege = function (priv) {
                return _.find($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name === priv;
                });
            };

            var init = function () {
                initializeActionConfig();
                $scope.encounterConfig = $scope.$parent.encounterConfig;
                $scope.currentVisitTypeUuid = getCurrentVisitTypeUuid();
                var defaultVisitType = appService.getAppDescriptor().getConfigValue('defaultVisitType');
                var visitTypes = encounterConfig.getVisitTypes();
                $scope.visitControl = new Bahmni.Common.VisitControl(visitTypes, defaultVisitType, visitService);
                $scope.dashboard = Bahmni.Common.DisplayControl.Dashboard.create($scope.dashboardConfig || {}, $filter);
                $scope.sectionGroups = $scope.dashboard.getSections($scope.diseaseTemplates);
                return getVisit().then(dispositionService.getDispositionActions).then(function (response) {
                    if (response.data && response.data.results && response.data.results.length) {
                        $scope.dispositionActions = getDispositionActions(response.data.results[0].answers);
                        if ($scope.visitSummary) {
                            $scope.currentVisitType = $scope.visitSummary.visitType;
                        }
                    }
                });
            };

            var getEncounterData = function (encounterTypeUuid, visitTypeUuid) {
                var encounterData = {};
                encounterData.patientUuid = $scope.patient.uuid;
                encounterData.encounterTypeUuid = encounterTypeUuid;
                encounterData.visitTypeUuid = visitTypeUuid;
                encounterData.observations = $scope.adtObservations;
                encounterData.observations = _.filter(encounterData.observations, function (observation) {
                    return !_.isEmpty(observation.value);
                });
                encounterData.locationUuid = locationUuid;
                encounterData.orders = [];
                return encounterData;
            };

            var forwardUrl = function (response, option) {
                var appDescriptor = appService.getAppDescriptor();
                var forwardLink = appDescriptor.getConfig(option);
                forwardLink = forwardLink && forwardLink.value;

                var bedId = _.get($rootScope.bedDetails, 'bedId') || _.get($rootScope.selectedBedInfo, 'bed.bedId');
                var options = {
                    'patientUuid': $scope.patient.uuid,
                    'encounterUuid': response.encounterUuid,
                    'visitUuid': response.visitUuid,
                    'bedId': bedId
                };
                if (forwardLink) {
                    $state.transitionTo("bedManagement.patient", options, {
                        reload: true, inherit: false, notify: true
                    });
                }
            };

            var createEncounterAndContinue = function () {
                var currentVisitTypeUuid = getCurrentVisitTypeUuid();
                if (currentVisitTypeUuid !== null) {
                    var encounterData = getEncounterData($scope.encounterConfig.getAdmissionEncounterTypeUuid(), currentVisitTypeUuid);
                    return encounterService.create(encounterData).then(function (response) {
                        if ($scope.visitSummary === null) {
                            visitService.getVisitSummary(response.data.visitUuid).then(function (response) {
                                $scope.visitSummary = new Bahmni.Common.VisitSummary(response.data);
                            });
                        }
                        assignBedToPatient($rootScope.selectedBedInfo.bed, response.data.patientUuid, response.data.encounterUuid);
                        forwardUrl(response.data, "onAdmissionForwardTo");
                    });
                } else if ($scope.defaultVisitTypeName === null) {
                    messagingService.showMessage("error", "MESSAGE_DEFAULT_VISIT_TYPE_NOT_FOUND_KEY");
                } else {
                    messagingService.showMessage("error", "MESSAGE_DEFAULT_VISIT_TYPE_INVALID_KEY");
                }
                return $q.when({});
            };

            var assignBedToPatient = function (bed, patientUuid, encounterUuid) {
                spinner.forPromise(bedService.assignBed(bed.bedId, patientUuid, encounterUuid).then(function () {
                    bed.status = "OCCUPIED";
                    $scope.$emit("event:patientAssignedToBed", $rootScope.selectedBedInfo.bed);
                    messagingService.showMessage('info', "Bed " + bed.bedNumber + " is assigned successfully");
                }));
            };
            
            var quotationExists = function (patientId) {
                return bedStatusService.doesQuotationExist(patientId);
            };

            var depositAmount = async function(patientId) {
                var depositAmount = await bedStatusService.getDepositAmount(patientId);
                console.log(depositAmount)
                return depositAmount;
            };

            var getDisposition = function (patientUuid) {
                return dispositionService.getDispositionByPatient(patientUuid, 1);
            };

            var getBedOrderType = function (patientUuid) {
                return $http.get(Bahmni.Common.Constants.sqlUrl, {
                    method: "GET",
                    params: {
                        q: "emrapi.sqlSearch.patientsLastBedOrder",
                        person_uuid: patientUuid
                    },
                    withCredentials: true
                });
            };

            var normalizeWard = function (ward) {
                return ward && ward.trim().toLowerCase();
            };

            var parsePreviousBedType = function (conceptName) {
                if (!conceptName) {
                    return null;
                }
                return conceptName.split(" ")[0].trim().toLowerCase();
            };

            var getBedOrderDecision = function (dispositionCode, previousBedType, selectedWard) {
                var toWard = normalizeWard(selectedWard);

                if (dispositionCode === "ADMIT") {
                    return {
                        encounterTypeUuid: $scope.encounterConfig.encounterTypes.Consultation,
                        comment: "Deposit request for patient admission",
                        quotationRequired: false
                    };
                }

                if (dispositionCode === "TRANSFER") {
                    if (previousBedType === "icu" && toWard !== "icu") {
                        return {
                            encounterTypeUuid: $scope.encounterConfig.encounterTypes.TRANSFER,
                            comment: "Transfer patient from ICU",
                            quotationRequired: true
                        };
                    }
                    if ((previousBedType === "general" || previousBedType === "surgical") && toWard === "icu") {
                        return {
                            encounterTypeUuid: $scope.encounterConfig.encounterTypes.TRANSFER,
                            comment: "Transfer Patient to ICU",
                            quotationRequired: true
                        };
                    }
                    return {
                        skip: true,
                        reason: "No bed deposit order is required for a transfer between " + previousBedType + " and " + selectedWard + " wards."
                    };
                }

                return null;
            };

            var createBedDepositOrder = function (decision, bedOrderType) {
                var visitTypeUuid = getCurrentVisitTypeUuid();
                if (visitTypeUuid === null) {
                    return $q.reject({message: "Unable to determine visit type for this patient."});
                }

                var encounterData = getEncounterData(decision.encounterTypeUuid, visitTypeUuid);

                return bedService.getBedServiceConcept(bedOrderType).catch(function () {
                    return $q.reject({message: "Failed to look up bed deposit service for: " + bedOrderType + "."});
                }).then(function (responses) {
                    if (!responses.data || !responses.data.length) {
                        return $q.reject({message: "Bed deposit service not found for: " + bedOrderType + "."});
                    }

                    var bedServiceOrder = {
                        concept: {name: responses.data[0].name, uuid: responses.data[0].uuid},
                        commentToFulfiller: decision.comment,
                        urgency: "ROUTINE"
                    };

                    return quotationExists($rootScope.patient.identifier).catch(function () {
                        return $q.reject({message: "Failed to verify quotation status in Odoo."});
                    }).then(function (quotationResponse) {
                        var hasQuotation = quotationResponse.data;
                        var canProceed = decision.quotationRequired ? hasQuotation : !hasQuotation;

                        if (!canProceed) {
                            return $q.reject({
                                message: decision.quotationRequired
                                    ? "Patient must have an active admission quotation before a transfer deposit can be created."
                                    : "Patient already has an active bed deposit order."
                            });
                        }

                        encounterData.orders.push(bedServiceOrder);
                        return encounterService.create(encounterData).catch(function () {
                            return $q.reject({message: "Failed to save bed deposit order to the patient encounter."});
                        });
                    });
                });
            };

            var rejectWithMessage = function (message) {
                return $q.reject({message: message});
            };

            depositAmount($rootScope.patient.identifier).then(function(response) {
                $scope.hasDeposit = response.data > 0;
                console.log($scope.hasDeposit)
            });

            $scope.saveBedOrder = function () {
                if (!$rootScope.patient || !$rootScope.patient.uuid) {
                    messagingService.showMessage("error", "No patient selected.");
                    return;
                }

                if (!$scope.adt.selectedWard) {
                    messagingService.showMessage("error", "Please select a ward before sending to cashier.");
                    return;
                }

                var bedOrderType = $scope.adt.selectedWard + " Ward Bed Deposit";
                var patientUuid = $rootScope.patient.uuid;

                var promise = getDisposition(patientUuid).catch(function () {
                    return rejectWithMessage("Failed to load patient disposition.");
                }).then(function (dispositionValue) {
                    if (!dispositionValue.data || !dispositionValue.data.length) {
                        return rejectWithMessage("No disposition found for this patient.");
                    }

                    var dispositionCode = dispositionValue.data[0].code;

                    if (dispositionCode === "TRANSFER") {
                        return getBedOrderType(patientUuid).catch(function () {
                            return rejectWithMessage("Failed to load previous bed order for transfer.");
                        }).then(function (previousBedOrder) {
                            if (!previousBedOrder.data || !previousBedOrder.data.length) {
                                return rejectWithMessage("No previous bed order found for this transfer.");
                            }

                            var bedType = parsePreviousBedType(previousBedOrder.data[0].concept_name);
                            if (!bedType) {
                                return rejectWithMessage("Unable to determine previous ward from the last bed order.");
                            }

                            var decision = getBedOrderDecision(dispositionCode, bedType, $scope.adt.selectedWard);
                            if (decision && decision.skip) {
                                return rejectWithMessage(decision.reason);
                            }
                            if (!decision) {
                                return rejectWithMessage('Disposition "' + dispositionCode + '" does not support bed deposit orders.');
                            }

                            return createBedDepositOrder(decision, bedOrderType);
                        });
                    }

                    if (dispositionCode === "ADMIT") {
                        var admitDecision = getBedOrderDecision(dispositionCode, null, $scope.adt.selectedWard);
                        return createBedDepositOrder(admitDecision, bedOrderType);
                    }

                    return rejectWithMessage(
                        'Bed deposit orders are only available for Admit or Transfer dispositions. Current disposition: "' + dispositionCode + '".'
                    );
                }).then(function (createResponse) {
                    if (createResponse) {
                        messagingService.showMessage("info", "Order Successfully Created");
                    }
                }).catch(function (err) {
                    console.log(err);
                    messagingService.showMessage("error", (err && err.message) || "Failed to create bed deposit order.");
                });

                spinner.forPromise(promise);
            };

            $scope.admit = function () {
                if (angular.isUndefined($rootScope.selectedBedInfo.bed)) {
                    messagingService.showMessage("error", "Please select a bed to admit patient");
                } else if ($scope.visitSummary && $scope.visitSummary.visitType !== $scope.defaultVisitTypeName && !hideStartNewVisitPopUp) {
                    ngDialog.openConfirm({
                        template: 'views/visitChangeConfirmation.html',
                        scope: $scope,
                        closeByEscape: true
                    });
                } else {
                    ngDialog.openConfirm({
                        template: 'views/admitConfirmation.html',
                        scope: $scope,
                        closeByEscape: true,
                        className: "ngdialog-theme-default ng-dialog-adt-popUp"
                    });
                }
                return $q.when({});
            };

            $scope.cancelConfirmationDialog = function () {
                ngDialog.close();
            };

            $scope.closeCurrentVisitAndStartNewVisit = function () {
                if (defaultVisitTypeUuid !== null) {
                    var encounter = getEncounterData($scope.encounterConfig.getAdmissionEncounterTypeUuid(), defaultVisitTypeUuid);
                    visitService.endVisitAndCreateEncounter($scope.visitSummary.uuid, encounterService.buildEncounter(encounter)).then(function (response) {
                        var carryMedicoLegal = $scope.isCurrentVisitMedicoLegal === true;
                        var newVisitUuid = response.data.visitUuid;
                        var refreshSummary = function () {
                            return visitService.getVisitSummary(newVisitUuid).then(function (summaryResponse) {
                                $scope.visitSummary = new Bahmni.Common.VisitSummary(summaryResponse.data);
                            });
                        };
                        var afterMedico = carryMedicoLegal && newVisitUuid
                            ? visitService.setMedicoLegalAttributeOnVisit(newVisitUuid).then(refreshSummary, function (err) {
                                var serverMsg = err && err.data && (err.data.message || (err.data.error && err.data.error.message));
                                messagingService.showMessage("error", serverMsg || "Could not set Medico Legal Case on the new visit.");
                                return refreshSummary();
                            })
                            : refreshSummary();
                        return afterMedico.then(function () {
                            return response;
                        });
                    }).then(function (response) {
                        if (response && response.data) {
                            assignBedToPatient($rootScope.selectedBedInfo.bed, response.data.patientUuid, response.data.encounterUuid);
                            forwardUrl(response.data, "onAdmissionForwardTo");
                        }
                    });
                } else if ($scope.defaultVisitTypeName === null) {
                    messagingService.showMessage("error", "MESSAGE_DEFAULT_VISIT_TYPE_NOT_FOUND_KEY");
                } else {
                    messagingService.showMessage("error", "MESSAGE_DEFAULT_VISIT_TYPE_INVALID_KEY");
                }
                ngDialog.close();
                return $q.when({});
            };

            $scope.continueWithCurrentVisit = function () {
                createEncounterAndContinue();
                ngDialog.close();
            };

            spinner.forPromise(init());

            $scope.disableAdmitButton = function () {
                return !($rootScope.patient && !$rootScope.bedDetails);
            };

            $scope.disableTransfer = function () {
                return !($rootScope.patient && $rootScope.bedDetails && !isCurrentPatientPresentOnSelectedBed());
            };

            var isCurrentPatientPresentOnSelectedBed = function () {
                if ($rootScope.selectedBedInfo.bed) {
                    return $rootScope.selectedBedInfo.bed.bedId === $rootScope.bedDetails.bedId;
                }
                return false;
            };
            $scope.disableDischargeButton = function () {
                return !($rootScope.patient && $rootScope.bedDetails && isCurrentPatientPresentOnSelectedBed() && $scope.canBeDischarged);
            };

            $scope.transfer = function () {
                if (angular.isUndefined($rootScope.selectedBedInfo.bed) || $rootScope.selectedBedInfo.bed.bedId === $rootScope.bedDetails.bedId) {
                    messagingService.showMessage("error", "Please select a bed to transfer the patient");
                } else {
                    ngDialog.openConfirm({
                        template: 'views/transferConfirmation.html',
                        scope: $scope,
                        closeByEscape: true,
                        className: "ngdialog-theme-default ng-dialog-adt-popUp"
                    });
                }
            };

            var reloadStateWithContextParams = function () {
                var selectedBedInfo = $rootScope.selectedBedInfo;
                var options = {
                    patientUuid: $scope.patient.uuid,
                    context: {
                        roomName: selectedBedInfo.roomName,
                        department: {
                            uuid: selectedBedInfo.wardUuid,
                            name: selectedBedInfo.wardName,
                            roomName: selectedBedInfo.roomName
                        }
                    }
                };
                $state.transitionTo("bedManagement.patient", options, {
                    reload: true, inherit: false, notify: true
                });
            };

            var disableButton = function () {
                $scope.isDisabled = true;
            };

            var executeTransfer = function () {
                spinner.forPromise(bedService.getCompleteBedDetailsByBedId($rootScope.selectedBedInfo.bed.bedId).then(function (response) {
                    var bedDetails = response.data;
                    if (!bedDetails.patients.length) {
                        var encounterData = getEncounterData($scope.encounterConfig.encounterTypes.TRANSFER, getCurrentVisitTypeUuid());
                        encounterService.create(encounterData).then(function (response) {
                            assignBedToPatient($rootScope.selectedBedInfo.bed, response.data.patientUuid, response.data.encounterUuid);
                            ngDialog.close();
                            forwardUrl(response.data, "onTransferForwardTo");
                        });
                    } else {
                        showErrorMessage(bedDetails);
                        reloadStateWithContextParams();
                    }
                }));
            };

            $scope.transferConfirmation = function () {
                ngDialog.openConfirm({
                    template: 'views/bedOrderCheckConfirmation.html',
                    scope: $scope,
                    closeByEscape: false,
                    closeByDocument: false,
                    className: "ngdialog-theme-default ng-dialog-adt-popUp"
                }).then(function () {
                    executeTransfer();
                }, function () {
                    messagingService.showMessage("info", "Transfer stopped. Please send the patient to cashier and create the correct bed deposit order first.");
                });
            };

            $scope.discharge = function () {
                if (!$rootScope.bedDetails.bedNumber) {
                    messagingService.showMessage("error", "Please select a bed to discharge the patient");
                } else {
                    visitService.search({patient: $scope.patient.uuid, v: customVisitParams, includeInactive: false}).then(function (visitResponse) {
                        var visitUuid = getPatientSpecificActiveVisits(visitResponse);
                        if (!visitUuid) {
                            messagingService.showMessage("error", "No active visit found for this patient");
                        } else {
                            ngDialog.openConfirm({
                                template: 'views/dischargeConfirmation.html',
                                scope: $scope,
                                closeByEscape: true,
                                className: "ngdialog-theme-default ng-dialog-adt-popUp"
                            });
                        }
                    });
                }
            };

            $scope.dischargeConfirmation = function () {
                var encounterData = getEncounterData($scope.encounterConfig.getDischargeEncounterTypeUuid());
                return spinner.forPromise(encounterService.discharge(encounterData).then(function (response) {
                    visitService.endVisit(response.data.visitUuid);
                    ngDialog.close();
                    forwardUrl(response.data, "onDischargeForwardTo");
                    var bedNumber = _.get($rootScope.bedDetails, 'bedNumber') || _.get($rootScope.selectedBedInfo, 'bed.bedNumber');
                    messagingService.showMessage('info', "Successfully discharged from " + bedNumber);
                }));
            };

            var showErrorMessage = function (bedDetails) {
                var patient = bedDetails.patients[0];
                var identifier = patient.display && patient.display.split(" - ")[0];
                patient.identifiers[0].identifier = identifier;
                messagingService.showMessage('error', "Please select an available bed. This bed is already assigned to " + identifier);
                $scope.cancelConfirmationDialog();
            };

            $scope.admitConfirmation = function () {
                bedService.getCompleteBedDetailsByBedId($rootScope.selectedBedInfo.bed.bedId).then(function (response) {
                    var bedDetails = response.data;
                    if (bedDetails.patients.length) {
                        showErrorMessage(bedDetails);
                        reloadStateWithContextParams();
                        return;
                    }
                    if (hideStartNewVisitPopUp && $scope.visitSummary && getVisitTypeUuid($scope.visitSummary.visitType) !== defaultVisitTypeUuid) {
                        $scope.closeCurrentVisitAndStartNewVisit();
                    } else {
                        createEncounterAndContinue();
                        $scope.cancelConfirmationDialog();
                    }
                });
            };
        }
    ]);
