'use strict';

angular.module('bahmni.clinical')
    .controller('AddTreatmentController', ['$scope', '$rootScope', 'contextChangeHandler', 'treatmentConfig', 'drugService',
        '$timeout', 'clinicalAppConfigService', 'ngDialog', '$window', 'messagingService', 'appService', 'activeDrugOrders',
        'orderSetService', '$q', 'locationService','diagnosisService', 'spinner', '$translate',
        function ($scope, $rootScope, contextChangeHandler, treatmentConfig, drugService, $timeout,
                  clinicalAppConfigService, ngDialog, $window, messagingService, appService, activeDrugOrders,
                  orderSetService, $q, locationService, diagnosisService,spinner, $translate) {
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var DrugOrderViewModel = Bahmni.Clinical.DrugOrderViewModel;
            var scrollTop = _.partial($window.scrollTo, 0, 0);
            $scope.defunits=["Tablet","Capsule","Vial"];
            $scope.showOrderSetDetails = true;
            var duURL = appService.getAppDescriptor().getConfigValue("duURL");
            var stockURL = appService.getAppDescriptor().getConfigValue("stockURL");
            var itemStockURL = appService.getAppDescriptor().getConfigValue("itemStockURL");
            $scope.addTreatment = true;
            $scope.canOrderSetBeAdded = true;
            $scope.isSearchDisabled = false;
            $scope.isMedicalSupply = false;

            // This is to add a unit field that is fetched from drug name . Drugs names include unit to meet dagu requirement
             $scope.unit = "";
             $scope.changeUnit = function (item){
                 var sub = item.split(" in (");
                 var text = sub[1]
                 var n = text.indexOf(")");
                 $scope.unit = "in " + text.slice(0,n);
                 $scope.treatment.itemUnit =  $scope.unit;
                 // to avoid the previous unit throwing error
                 if($scope.treatment.uniformDosingType.doseUnits==undefined || $scope.treatment.uniformDosingType == null || $scope.treatment.uniformDosingType=='')
                 $scope.treatment.uniformDosingType.doseUnits = "mg";
              
             }

             $scope.defunitselected = function(item){
                $scope.unit = item;
                $scope.treatment.itemUnit =  $scope.unit;
                 // to avoid the previous unit throwing error
                 if($scope.treatment.uniformDosingType.doseUnits==undefined || $scope.treatment.uniformDosingType == null || $scope.treatment.uniformDosingType=='')
                 $scope.treatment.uniformDosingType.doseUnits = "mg";
             
            }
            $scope.getFilteredOrderSets = function (searchTerm) {
                if (searchTerm && searchTerm.length >= 3) {
                    orderSetService.getOrderSetsByQuery(searchTerm).then(function (response) {
                        $scope.orderSets = response.data.results;
                        _.each($scope.orderSets, function (orderSet) {
                            _.each(orderSet.orderSetMembers, setUpOrderSetTransactionalData);
                        });
                    });
                } else {
                    $scope.orderSets = {};
                }
            };

            $scope.treatmentActionLinks = clinicalAppConfigService.getTreatmentActionLink();

            var preFetchDrugsForGivenConceptSet = function () {
                drugService.getSetMembersOfConcept(treatmentConfig.getDrugConceptSet()).then(function (result) {
                    $scope.drugs = result.map(Bahmni.Clinical.DrugSearchResult.create);
                });
            };
            if (treatmentConfig.isDropDownForGivenConceptSet()) {
                preFetchDrugsForGivenConceptSet();
            }
            if (treatmentConfig.isAutoCompleteForAllConcepts()) {
                $scope.getDrugs = function (request) {
                    var drugs = drugService.search(request.term);
                    if ($scope.stock != undefined) {
                        drugs.then(function (drugsIncluded) {
                            drugsIncluded.forEach(element => {
                                const result = $scope.stock.find(({itemUnit})=> itemUnit === element.uuid);
                                if (result != undefined) {
                                    element.stock = result.hasStock;
                                    element.quantity = result.quantity;
                                }
                                else {
                                    element.stock = false;
                                    element.quantity = 0;
                                }
                            });
                        });
                    }
                    return drugs;
                };
            }
            if (treatmentConfig.isAutoCompleteForGivenConceptSet()) {
                $scope.getDrugs = function (request) {
                    return drugService.getSetMembersOfConcept(treatmentConfig.getDrugConceptSet(), request.term);
                };
            }

            $scope.doseFractions = treatmentConfig.getDoseFractions();

            $scope.hideOrderSet = treatmentConfig.inputOptionsConfig.hideOrderSet;

            $scope.showDoseFractions = treatmentConfig.inputOptionsConfig.showDoseFractions;
            $scope.isDoseFractionsAvailable = function () {
                return $scope.doseFractions && !_.isEmpty($scope.doseFractions) ? true : false;
            };

            $scope.isSelected = function (drug) {
                var selectedDrug = $scope.treatment.drug;
                return selectedDrug && drug.drug.name === selectedDrug.name;
            };

            $scope.selectFromDefaultDrugList = function () {
                $scope.onSelect($scope.treatment.selectedItem);
            };

            var markVariable = function (variable) {
                $scope[variable] = true;
                $timeout(function () {
                    $scope[variable] = false;
                });
            };

            var markEitherVariableDrugOrUniformDrug = function (drug) {
                if (drug.isVariableDosingType()) {
                    markVariable('editDrugEntryVariableFrequency');
                } else {
                    markVariable('editDrugEntryUniformFrequency');
                }
            };

            markVariable("startNewDrugEntry");

            var setDrugOrderBeingEdited, clearHighlights;
            (function () {
                var drugOrderBeingEdited = null;

                setDrugOrderBeingEdited = function (drugOder) {
                    drugOrderBeingEdited = drugOder;
                };

                clearHighlights = function () {
                    $scope.treatments.forEach(setIsNotBeingEdited);
                    $scope.orderSetTreatments.forEach(setIsNotBeingEdited);
                    if (drugOrderBeingEdited) {
                        drugOrderBeingEdited.isBeingEdited = false;
                        drugOrderBeingEdited.isDiscontinuedAllowed = true;
                    }
                };
            })();

            var encounterDate = DateUtil.parse($scope.consultation.encounterDateTime);
            var newTreatment = function () {
                var newTreatment = new Bahmni.Clinical.DrugOrderViewModel(treatmentConfig, null, encounterDate);
                newTreatment.isEditAllowed = false;
                return newTreatment;
            };

            $scope.treatment = newTreatment();
            treatmentConfig.durationUnits.forEach(function (durationUnit) {
                if (_.isEqual(durationUnit, $scope.treatment.durationUnit)) {
                    $scope.treatment.durationUnit = durationUnit;
                }
            });

            var watchFunctionForQuantity = function () {
                var treatment = $scope.treatment;
                return {
                    uniformDosingType: treatment.uniformDosingType,
                    variableDosingType: treatment.variableDosingType,
                    doseUnits: treatment.doseUnits,
                    duration: treatment.duration,
                    durationUnit: treatment.durationUnit
                };
            };

            var isSameDrugBeingDiscontinuedAndOrdered = function () {
                var existingTreatment = false;
                angular.forEach($scope.consultation.discontinuedDrugs, function (drugOrder) {
                    existingTreatment = _.some($scope.treatments, function (treatment) {
                        return treatment.getDisplayName() === drugOrder.getDisplayName();
                    }) && drugOrder.isMarkedForDiscontinue;
                });
                return existingTreatment;
            };

            var clearOtherDrugOrderActions = function (drugOrders) {
                drugOrders.forEach(function (drugOrder) {
                    drugOrder.isDiscontinuedAllowed = true;
                    drugOrder.isBeingEdited = false;
                });
            };

            var setNonCodedDrugConcept = function (treatment) {
                if (treatment.drugNonCoded) {
                    treatment.concept = treatmentConfig.nonCodedDrugconcept;
                }
            };

            $scope.refillDrug = function (drugOrder, alreadyActiveSimilarOrder) {
                $scope.bulkSelectCheckbox = false;
                var existingOrderStopDate = alreadyActiveSimilarOrder ? alreadyActiveSimilarOrder.effectiveStopDate : null;
                var refillDrugOrder = drugOrder.refill(existingOrderStopDate);
                setNonCodedDrugConcept(refillDrugOrder);
                setDrugOrderBeingEdited(drugOrder);
                $scope.treatments.push(refillDrugOrder);
                markVariable("startNewDrugEntry");
                ngDialog.close();
            };

            $scope.taperDrug = function (drugOrder, alreadyActiveSimilarOrder) {
                drugOrder.taper = false;
                $scope.bulkSelectCheckbox = false;
                var existingOrderStopDate = alreadyActiveSimilarOrder ? alreadyActiveSimilarOrder.effectiveStopDate : drugOrder.effectiveStopDate;
                var refillDrugOrder = drugOrder.refill(existingOrderStopDate);
                 $rootScope.$broadcast("event:editDrugOrder", refillDrugOrder, alreadyActiveSimilarOrder+1);
                refillDrugOrder.effectiveStartDate = existingOrderStopDate;
                setNonCodedDrugConcept(refillDrugOrder);
                setDrugOrderBeingEdited(drugOrder);
                $scope.treatments.push(refillDrugOrder);
                markVariable("startNewDrugEntry");
                ngDialog.close();
              
            };


            $scope.refillOrderSet = function (drugOrder) {
                ngDialog.close();
                var drugOrdersOfOrderGroup = _.filter($scope.consultation.activeAndScheduledDrugOrders, function (treatment) {
                    return treatment.orderGroupUuid === drugOrder.orderGroupUuid;
                });

                var refilledOrderGroupOrders = [];
                drugOrdersOfOrderGroup.forEach(function (drugOrder) {
                    setNonCodedDrugConcept(drugOrder);
                    if (drugOrder.effectiveStopDate) {
                        refilledOrderGroupOrders.push(drugOrder.refill());
                    }
                });

                setSortWeightForOrderSetDrugs(refilledOrderGroupOrders);

                // Fetch the orderSet for the drugOrder
                var matchedOrderSet = _.find(orderSets, {uuid: drugOrder.orderSetUuid});

                // Find the drugs in ordered DrugOrderSet which matches with the matchedOrderSet SetMembers
                var orderSetMembersOfMatchedOrderSet = matchedOrderSet.orderSetMembers;
                var matchedMembers = [];

                _.each(refilledOrderGroupOrders, function (drugOrder) {
                    _.each(orderSetMembersOfMatchedOrderSet, function (orderSetMember) {
                        if (orderSetMember.orderTemplate.drug) {
                            if (orderSetMember.orderTemplate.drug.uuid === _.get(drugOrder, 'drug.uuid')) { matchedMembers.push(orderSetMember); }
                        } else {
                            if (orderSetMember.concept.uuid === drugOrder.concept.uuid) { matchedMembers.push(orderSetMember); }
                        }
                    });
                });

                var listOfPromises = _.map(matchedMembers, function (eachMember, index) {
                    if (eachMember.orderTemplate) {
                        var doseUnits = eachMember.orderTemplate.dosingInstructions.doseUnits;
                        var baseDose = eachMember.orderTemplate.dosingInstructions.dose;
                        var drugName = eachMember.orderTemplate.concept.name;
                        return orderSetService.getCalculatedDose($scope.patient.uuid, drugName, baseDose, doseUnits, $scope.newOrderSet.name)
                                     .then(function (calculatedDosage) {
                                         refilledOrderGroupOrders[index].uniformDosingType.dose = calculatedDosage.dose;
                                         refilledOrderGroupOrders[index].uniformDosingType.doseUnits = calculatedDosage.doseUnit;
                                         refilledOrderGroupOrders[index].calculateQuantityAndUnit();
                                     });
                    }
                });

                spinner.forPromise($q.all(listOfPromises).then(function () {
                    Array.prototype.push.apply($scope.treatments, refilledOrderGroupOrders);
                }));
            };

            $scope.$on("event:refillDrugOrder", function (event, drugOrder, alreadyActiveSimilarOrder) {
                // Todo -- Removed orderset refill logic , since its needs more analysis

                /* if (drugOrder.orderGroupUuid) {
                    ngDialog.open({
                        template: 'consultation/views/treatmentSections/refillDrugOrderSetModal.html',
                        scope: $scope,
                        data: {
                            drugOrder: drugOrder,
                            alreadyActiveSimilarOrder: alreadyActiveSimilarOrder
                        }
                    });
                    $scope.popupActive = true;
                    return;
                } */
                $scope.refillDrug(drugOrder, alreadyActiveSimilarOrder);
            });
            $scope.$on("event:taperDrugOrder", function (event, drugOrder, alreadyActiveSimilarOrder) {
                $scope.taperDrug(drugOrder, alreadyActiveSimilarOrder);
            });

            var refillDrugOrders = function (drugOrders) {
                drugOrders.forEach(function (drugOrder) {
                    setNonCodedDrugConcept(drugOrder);
                    if (drugOrder.effectiveStopDate) {
                        var refill = drugOrder.refill();
                        $scope.treatments.push(refill);
                    }
                });
            };

            $scope.$on("event:sectionUpdated", function (event, drugOrder) {
                _.remove($scope.consultation.activeAndScheduledDrugOrders, function (activeOrder) {
                    return activeOrder.uuid === drugOrder.uuid;
                });
            });

            $scope.$on("event:refillDrugOrders", function (event, drugOrders) {
                $scope.bulkSelectCheckbox = false;
                refillDrugOrders(drugOrders);
            });

            $scope.$on("event:discontinueDrugOrder", function (event, drugOrder) {
                drugOrder.isMarkedForDiscontinue = true;
                drugOrder.isEditAllowed = false;
                drugOrder.dateStopped = DateUtil.now();
                $scope.consultation.discontinuedDrugs.push(drugOrder);
                $scope.minDateStopped = DateUtil.getDateWithoutTime(drugOrder.effectiveStartDate < DateUtil.now() ? drugOrder.effectiveStartDate : DateUtil.now());
            });

            $scope.$on("event:undoDiscontinueDrugOrder", function (event, drugOrder) {
                $scope.consultation.discontinuedDrugs = _.reject($scope.consultation.discontinuedDrugs, function (removableOrder) {
                    return removableOrder.uuid === drugOrder.uuid;
                });
                $scope.consultation.removableDrugs = _.reject($scope.consultation.removableDrugs, function (removableOrder) {
                    return removableOrder.previousOrderUuid === drugOrder.uuid;
                });
                drugOrder.orderReasonConcept = null;
                drugOrder.dateStopped = null;
                drugOrder.orderReasonText = null;
                drugOrder.isMarkedForDiscontinue = false;
                drugOrder.isEditAllowed = true;
            });

            var selectDrugFromDropdown = function (drug_) {
                if (treatmentConfig.isDropDownForGivenConceptSet()) {
                    $scope.treatment.selectedItem = _.find($scope.drugs, function (drug) {
                        return drug.drug.uuid === drug_.uuid;
                    });
                }
            };

            $scope.$on("event:reviseDrugOrder", function (event, drugOrder, drugOrders) {
                clearOtherDrugOrderActions(drugOrders);
                drugOrder.isBeingEdited = true;
                drugOrder.isDiscontinuedAllowed = false;
                $scope.treatments.forEach(setIsNotBeingEdited);
                setDrugOrderBeingEdited(drugOrder);
                $scope.treatment = drugOrder.revise();
                delete $scope.treatment._manualAdditionalInstructions;
                selectDrugFromDropdown(drugOrder.drug);
                markEitherVariableDrugOrUniformDrug($scope.treatment);
                $scope.treatment.currentIndex = $scope.treatments.length + 1;
                if ($scope.treatment.frequencyType === Bahmni.Clinical.Constants.dosingTypes.variable) {
                    $scope.treatment.isUniformFrequency = false;
                }
                if($scope.treatment.variableDosingType.nightDose!=0){
                    $scope.threeVariableDoseType = false;
                    $scope.fourVariableDoseType = true;
                }
                if($scope.treatment.variableDosingType.nightDose==0){
                    $scope.threeVariableDoseType = true;
                    $scope.fourVariableDoseType = false;
                }

                $scope.treatment.quantity = $scope.treatment.quantity ? $scope.treatment.quantity : null;
            });


            $scope.$watch(watchFunctionForQuantity, function () {
                $scope.treatment.calculateQuantityAndUnit();
            }, true);

            var AUTO_ADDITIONAL_INSTRUCTION_PATTERN = /(?:Frequency|Route|Dose|Start Date|Duration|Units|Total Quantity):\s*[^,]+(?:,\s*)?/gi;

            var extractManualAdditionalInstructions = function (text) {
                if (!text) {
                    return '';
                }
                return text.replace(AUTO_ADDITIONAL_INSTRUCTION_PATTERN, '').replace(/^,\s*|,\s*$/g, '').trim();
            };

            var formatDurationUnit = function (durationUnit) {
                if (!durationUnit) {
                    return '';
                }
                return durationUnit.name || durationUnit;
            };

            var formatUniformDose = function (treatment) {
                var uniformDosingType = treatment.uniformDosingType || {};
                var doseParts = [];
                if (uniformDosingType.dose) {
                    doseParts.push(uniformDosingType.dose);
                }
                if (uniformDosingType.doseFraction && uniformDosingType.doseFraction.label) {
                    doseParts.push(uniformDosingType.doseFraction.label);
                }
                return doseParts.join(' ').trim();
            };

            var formatVariableDose = function (treatment) {
                var variableDosingType = treatment.variableDosingType || {};
                if (treatment.isVariableDoseEmpty && treatment.isVariableDoseEmpty(variableDosingType)) {
                    return '';
                }
                var hasFourDoses = variableDosingType.nightDose !== 0 &&
                    variableDosingType.nightDose !== undefined &&
                    variableDosingType.nightDose !== null &&
                    variableDosingType.nightDose !== '';
                var doseParts;
                if (hasFourDoses) {
                    doseParts = [
                        'Morning: ' + (variableDosingType.morningDose || 0),
                        'MidDay: ' + (variableDosingType.afternoonDose || 0),
                        'Night: ' + (variableDosingType.eveningDose || 0),
                        'MidNight: ' + (variableDosingType.nightDose || 0)
                    ];
                } else {
                    doseParts = [
                        'Morning: ' + (variableDosingType.morningDose || 0),
                        'Afternoon: ' + (variableDosingType.afternoonDose || 0),
                        'Night: ' + (variableDosingType.eveningDose || 0)
                    ];
                }
                return doseParts.join(', ');
            };

            var buildAutoAdditionalInstructions = function (treatment) {
                var parts = [];

                if (treatment.isUniformFrequency && treatment.uniformDosingType && treatment.uniformDosingType.frequency) {
                    parts.push('Frequency: ' + treatment.uniformDosingType.frequency);
                } else if (!treatment.isUniformFrequency && treatment.variableDoseType) {
                    parts.push('Frequency: ' + (treatment.variableDoseType === 'four' ? '4/Day' : '3/Day'));
                }
                if (treatment.route) {
                    parts.push('Route: ' + treatment.route);
                }

                var doseValue = treatment.isUniformFrequency ? formatUniformDose(treatment) : formatVariableDose(treatment);
                if (doseValue) {
                    parts.push('Dose: ' + doseValue);
                }

                if (treatment.effectiveStartDate) {
                    parts.push('Start Date: ' + DateUtil.getDateWithoutTime(treatment.effectiveStartDate));
                }

                if (treatment.duration) {
                    var durationUnit = formatDurationUnit(treatment.durationUnit);
                    parts.push('Duration: ' + treatment.duration + (durationUnit ? ' ' + durationUnit : ''));
                } else if (treatment.durationUnit) {
                    parts.push('Duration: ' + formatDurationUnit(treatment.durationUnit));
                }

                var doseUnits = treatment.doseUnits || $scope.unit;
                if (doseUnits) {
                    parts.push('Units: ' + doseUnits);
                }

                if (treatment.quantity) {
                    var quantityUnit = $scope.unit || treatment.quantityUnit;
                    parts.push('Total Quantity: ' + treatment.quantity + (quantityUnit ? ' ' + quantityUnit : ''));
                }

                return parts.join(', ');
            };

            var syncAdditionalInstructions = function () {
                var treatment = $scope.treatment;
                if (!treatment || treatmentConfig.isHiddenField('additionalInstructions')) {
                    return;
                }

                if (treatment._manualAdditionalInstructions === undefined) {
                    treatment._manualAdditionalInstructions = extractManualAdditionalInstructions(treatment.additionalInstructions);
                }

                var autoInstructions = buildAutoAdditionalInstructions(treatment);
                var manualInstructions = treatment._manualAdditionalInstructions;
                treatment.additionalInstructions = autoInstructions;
                if (manualInstructions) {
                    treatment.additionalInstructions += (autoInstructions ? ', ' : '') + manualInstructions;
                }
            };

            var watchFunctionForAdditionalInstructions = function () {
                var treatment = $scope.treatment;
                return {
                    frequency: treatment.uniformDosingType && treatment.uniformDosingType.frequency,
                    route: treatment.route,
                    uniformDose: treatment.uniformDosingType && treatment.uniformDosingType.dose,
                    doseFraction: treatment.uniformDosingType && treatment.uniformDosingType.doseFraction,
                    morningDose: treatment.variableDosingType && treatment.variableDosingType.morningDose,
                    afternoonDose: treatment.variableDosingType && treatment.variableDosingType.afternoonDose,
                    eveningDose: treatment.variableDosingType && treatment.variableDosingType.eveningDose,
                    nightDose: treatment.variableDosingType && treatment.variableDosingType.nightDose,
                    variableDoseType: treatment.variableDoseType,
                    isUniformFrequency: treatment.isUniformFrequency,
                    effectiveStartDate: treatment.effectiveStartDate,
                    duration: treatment.duration,
                    durationUnit: treatment.durationUnit,
                    quantity: treatment.quantity,
                    doseUnits: treatment.doseUnits,
                    unit: $scope.unit
                };
            };

            $scope.$watch(watchFunctionForAdditionalInstructions, syncAdditionalInstructions, true);

            $scope.onAdditionalInstructionsChange = function () {
                if ($scope.treatment) {
                    $scope.treatment._manualAdditionalInstructions = extractManualAdditionalInstructions($scope.treatment.additionalInstructions);
                }
            };

            var hasMainDiagnosis = function (patientUuid, activeVisit) {
                return diagnosisService.getDiagnoses(patientUuid, activeVisit).then(function (response) {
                    var diagnoses = response.data || [];

                    if (diagnoses.length === 0) {
                        return false;
                    }else{
                        return true;
                    }
                });
            };

            $scope.add = function () {
                var patientUuid = $scope.patient.uuid;
                var activeVisit = $scope.activeVisit.uuid;

                hasMainDiagnosis(patientUuid,activeVisit).then(function(hasMain){
                    if (!hasMain) {
                        messagingService.showMessage("error", "Please fill a main diagnosis before prescription");
                        $scope.clearForm();
                        return; 
                    }

                    var treatments = $scope.treatments;
                    if ($scope.treatment.isNewOrderSet) {
                        treatments = $scope.orderSetTreatments;
                    }
                    $scope.treatment.dosingInstructionType = Bahmni.Clinical.Constants.flexibleDosingInstructionsClass;
                    if ($scope.treatment.isNonCodedDrug) {
                        $scope.treatment.drugNonCoded = $scope.treatment.drugNameDisplay;
                    }
                    $scope.treatment.setUniformDoseFraction();
                    $scope.treatment.DU = $scope.DispensingUnit;
                    var newDrugOrder = $scope.treatment;
                    setNonCodedDrugConcept($scope.treatment);

                    newDrugOrder.calculateEffectiveStopDate();

                    if (getConflictingDrugOrder(newDrugOrder)) {
                        if ($scope.alreadyActiveSimilarOrder.isNewOrderSet) {
                            $scope.conflictingIndex = _.findIndex($scope.orderSetTreatments, $scope.alreadyActiveSimilarOrder);
                        } else {
                            $scope.conflictingIndex = _.findIndex($scope.treatments, $scope.alreadyActiveSimilarOrder);
                        }
                        ngDialog.open({
                            template: 'consultation/views/treatmentSections/conflictingDrugOrderModal.html',
                            scope: $scope
                        });
                        $scope.popupActive = true;
                        return;
                    }
                    if (!$scope.treatment.quantity) {
                        $scope.treatment.quantity = 0;
                    }

                    if ($scope.treatment.isBeingEdited) {
                        treatments.splice($scope.treatment.currentIndex, 1, $scope.treatment);
                        $scope.treatment.isBeingEdited = false;
                    } else {
                        treatments.push($scope.treatment);
                    }
                    if(treatments.length==1){
                        treatments[0].taper = true;
                    }
                //To attach ones effectiveStopDate to the other effectiveStartDate
                    if(treatments.length>1){
                        for(var i = 1; i<treatments.length;i++){
                    // treatments[i].effectiveStartDate = treatments[i-1].effectiveStopDate;
                        if(i==(treatments.length-1)){
                            treatments[i].taper = true;
                        }
                        }
                }     
                    treatments.forEach(treatment => {
                        if(treatment.durationUnit.includes("Hour(s)")){
                            var stopDate = new Date();
                        stopDate.setHours(treatment.effectiveStartDate.getHours() + treatment.duration);  
                        treatment.effectiveStopDate = stopDate;
                        }
                        treatment.drugNameDisplay = treatment.drug!=undefined || treatment.drug!=null ? treatment.drug.name : treatment.concept.name;
                    });
                    document.getElementById("drug-name").style.backgroundColor = "white";
                    var stockQuantityDiv = document.getElementById("stockQuantityDiv");
                    stockQuantityDiv.style.display = "none";
                    $scope.clearForm();
                });
            };
            
            $scope.threeVariableDoseType = true;
            $scope.changeVariableDoseType = function(){
                if($scope.treatment.variableDoseType == "four"){
                     $scope.afternoon = "Mid day";
                     $scope.fourVariableDoseType = true;
                     $scope.threeVariableDoseType = false;
                }
                if($scope.treatment.variableDoseType == "three"){
                    $scope.threeVariableDoseType = true;
                    $scope.fourVariableDoseType = false;
                    $scope.afternoon = "Afternoon"
                }
            }

            var getConflictingDrugOrder = function (newDrugOrder) {
                var allDrugOrders = $scope.treatments.concat($scope.orderSetTreatments);
                allDrugOrders = _.reject(allDrugOrders, newDrugOrder);
                var unsavedNotBeingEditedOrders = _.filter(allDrugOrders, {isBeingEdited: false});
                var existingDrugOrders;
                if (newDrugOrder.isBeingEdited) {
                    existingDrugOrders = _.reject($scope.consultation.activeAndScheduledDrugOrders, {uuid: newDrugOrder.previousOrderUuid});
                } else {
                    existingDrugOrders = $scope.consultation.activeAndScheduledDrugOrders;
                }
                existingDrugOrders = existingDrugOrders.concat(unsavedNotBeingEditedOrders);

                var potentiallyOverlappingOrders = existingDrugOrders.filter(function (drugOrder) {
                    return (drugOrder.getDisplayName() === newDrugOrder.getDisplayName() && drugOrder.overlappingScheduledWith(newDrugOrder));
                });

                setEffectiveDates(newDrugOrder, potentiallyOverlappingOrders);

                var alreadyActiveSimilarOrders = existingDrugOrders.filter(function (drugOrder) {
                    return (drugOrder.getDisplayName() === newDrugOrder.getDisplayName() && drugOrder.overlappingScheduledWith(newDrugOrder));
                });

                if (alreadyActiveSimilarOrders.length > 0) {
                    $scope.alreadyActiveSimilarOrder = _.sortBy(potentiallyOverlappingOrders, 'effectiveStartDate').reverse()[0];
                    return $scope.alreadyActiveSimilarOrder;
                }
                return false;
            };

            var isEffectiveStartDateSameAsToday = function (newDrugOrder) {
                return DateUtil.isSameDate(newDrugOrder.effectiveStartDate, DateUtil.parse(newDrugOrder.encounterDate)) &&
                    DateUtil.isSameDate(newDrugOrder.effectiveStartDate, DateUtil.now());
            };

            var setEffectiveDates = function (newDrugOrder, existingDrugOrders) {
                newDrugOrder.scheduledDate = newDrugOrder.effectiveStartDate;
                existingDrugOrders.forEach(function (existingDrugOrder) {
                    if (DateUtil.isSameDate(existingDrugOrder.effectiveStartDate, newDrugOrder.effectiveStopDate) && !DateUtil.isSameDate(existingDrugOrder.effectiveStopDate, newDrugOrder.effectiveStartDate)) {
                        if (!newDrugOrder.previousOrderUuid || newDrugOrder.previousOrderDurationInDays === newDrugOrder.durationInDays) {
                            newDrugOrder.effectiveStopDate = DateUtil.subtractSeconds(existingDrugOrder.effectiveStartDate, 1);
                        }
                        if (newDrugOrder.previousOrderUuid || DateUtil.isSameDate(newDrugOrder.effectiveStartDate, newDrugOrder.encounterDate)) {
                            newDrugOrder.autoExpireDate = newDrugOrder.effectiveStopDate;
                        }
                    }
                    if (DateUtil.isSameDate(existingDrugOrder.effectiveStopDate, newDrugOrder.effectiveStartDate) && DateUtil.isSameDate(DateUtil.addSeconds(existingDrugOrder.effectiveStopDate, 1), newDrugOrder.effectiveStartDate)) { // compare date part only of datetime
                        if (!existingDrugOrder.uuid) {
                            existingDrugOrder.effectiveStopDate = DateUtil.subtractSeconds(existingDrugOrder.effectiveStopDate, 1);
                        }
                        newDrugOrder.effectiveStartDate = DateUtil.addSeconds(existingDrugOrder.effectiveStopDate, 1);
                    }
                });
                if (isEffectiveStartDateSameAsToday(newDrugOrder)) {
                    newDrugOrder.scheduledDate = null;
                }
            };

            $scope.closeDialog = function () {
                ngDialog.close();
            };

            $scope.refillConflictingDrug = function (drugOrder, alreadyActiveSimilarOrder) {
                $scope.popupActive = false;
                ngDialog.close();
                $scope.clearForm();
                $scope.$broadcast("event:refillDrugOrder", drugOrder, alreadyActiveSimilarOrder);
            };

            $scope.revise = function (drugOrder, index) {
                $scope.popupActive = false;
                ngDialog.close();
                if (drugOrder.uuid) {
                    $scope.$broadcast("event:reviseDrugOrder", drugOrder, $scope.consultation.activeAndScheduledDrugOrders);
                } else {
                    edit(drugOrder, index);
                }
            };

            $scope.toggleShowAdditionalInstructions = function (treatment) {
                treatment.showAdditionalInstructions = !treatment.showAdditionalInstructions;
            };

            $scope.toggleAsNeeded = function (treatment) {
                treatment.asNeeded = !treatment.asNeeded;
            };

            var edit = function (drugOrder, index) {
                clearHighlights();
                var treatment = drugOrder;
                markEitherVariableDrugOrUniformDrug(treatment);
                treatment.isBeingEdited = true;
                $scope.treatment = treatment.cloneForEdit(index, treatmentConfig);
                delete $scope.treatment._manualAdditionalInstructions;
                if ($scope.treatment.quantity === 0) {
                    $scope.treatment.quantity = null;
                    $scope.treatment.quantityEnteredManually = false;
                }
                selectDrugFromDropdown(treatment.drug);
            };

            $scope.$on("event:editDrugOrder", function (event, drugOrder, index) {
                edit(drugOrder, index);
                $scope.getStock();
            });

            $scope.$on("event:removeDrugOrder", function (event, index) {
                $scope.treatments.splice(index, 1);
            });

            $scope.incompleteDrugOrders = function () {
                var anyValuesFilled = $scope.treatment.drug || $scope.treatment.uniformDosingType.dose ||
                    $scope.treatment.uniformDosingType.frequency || $scope.treatment.variableDosingType.morningDose ||
                    $scope.treatment.variableDosingType.afternoonDose || $scope.treatment.variableDosingType.eveningDose || $scope.treatment.variableDosingType.nightDose || 
                    $scope.treatment.duration || $scope.treatment.quantity || $scope.treatment.isNonCodedDrug || $scope.treatment.drugNameDisplay;
                return (anyValuesFilled && $scope.addForm.$invalid);
            };
            $scope.unaddedDrugOrders = function () {
                return $scope.addForm.$valid;
            };

            var contextChange = function () {
                var errorMessages = Bahmni.Clinical.Constants.errorMessages;
                if (isSameDrugBeingDiscontinuedAndOrdered()) {
                    return {allow: false, errorMessage: $translate.instant(errorMessages.discontinuingAndOrderingSameDrug)};
                }
                if ($scope.incompleteDrugOrders()) {
                    $scope.formInvalid = true;
                    return {allow: false};
                }
                if ($scope.unaddedDrugOrders()) {
                    return {allow: false, errorMessage: $translate.instant(errorMessages.incompleteForm)};
                }
                return {allow: true};
            };

            var setIsNotBeingEdited = function (treatment) {
                treatment.isBeingEdited = false;
            };
            $scope.onSelectStrength = function (item) {
                if(item || item==""){
                    $scope.units=$scope.grandObj[$scope.treatment.drugNameDisplay][item]
                    $scope.showUnit = true;
                    $scope.selectedUnit= $scope.units[0]
                    $scope.onSelectUnit($scope.selectedUnit.drugObject)
                }
                else $scope.showUnit = false;
                
            };
            $scope.onSelectUnit = function (item) {
                if (item) {
                    $scope.treatment.isNonCodedDrug = false;
                    delete $scope.treatment.drugNonCoded;
                    $scope.treatment.changeDrug({
                        name: item.name,
                        form: item.dosageForm && item.dosageForm.display,
                        uuid: item.uuid
                    });
                    $scope.changeUnit(item.name);
                    return;
                }

            }
            $scope.grandObj = {};
            $scope.getDataResults = function (drugs) {
                $scope.grandObj = {};
                var searchString = $scope.treatment.drugNameDisplay;
                var listOfDrugSynonyms = _.map(drugs, function (drug) {
                    return Bahmni.Clinical.DrugSearchResult.getAllMatchingSynonyms(drug,searchString);
                });
                listOfDrugSynonyms.forEach(eachDrug => {
                    if (eachDrug[0] != undefined)
                        eachDrug[0].label = eachDrug[0].drug.quantity != undefined ? eachDrug[0].label + "--" + eachDrug[0].drug.quantity : eachDrug[0].label;
                });
                $scope.onChange();
                return _.flatten(listOfDrugSynonyms);
                
                
            };

            (function () {
                var selectedItem;
                $scope.onSelect = function (item) {
                    $scope.treatment.uniformDosingType.dose = 1;
                    $scope.treatment.duration = 1;
                    selectedItem = item;
                    $scope.onChange();
                    $scope.changeUnit(item.drug.name);
                };
                $scope.onAccept = function () {
                    $scope.treatment.acceptedItem = $scope.treatment.drugNameDisplay;
                    $scope.showUnitDef = true;
                    $scope.onChange();
                    $scope.changeUnit(item);
                };

                $scope.onChange = function () {
                    const uls = document.getElementsByClassName("ui-menu-item");
                    for (let i =0; i < uls.length; i++){
                        setTimeout(()=>{
                            if (uls.length > 0 && uls[i] != undefined) {
                                if (uls[i].innerHTML.includes("--0"))
                                uls[i].style.backgroundColor = "#FFCCCB";
                                else if (uls[i].innerHTML.includes("--")) {
                                    uls[i].style.backgroundColor = "#90EE90";
                                }
                            }
                        },"1000");
                    }
                    if (selectedItem) {
                        $scope.treatment.isNonCodedDrug = false;
                        delete $scope.treatment.drugNonCoded;
                        $scope.treatment.changeDrug({
                           name: selectedItem.drug.name,
                           form: selectedItem.drug.dosageForm && selectedItem.drug.dosageForm.display,
                           uuid: selectedItem.drug.uuid
                        });
                        selectedItem = null;
                        return;
                    }
                    if ($scope.treatment.acceptedItem) {
                        $scope.treatment.isNonCodedDrug = !$scope.treatment.isNonCodedDrug;
                        $scope.treatment.drugNonCoded = $scope.treatment.acceptedItem;
                        delete $scope.treatment.drug;
                        delete $scope.treatment.acceptedItem;
                        return;
                    }
                    
                    $scope.showUnit= false;
                    delete $scope.treatment.drug;
                };
            })();

            $scope.clearForm = function () {
                $scope.treatment = newTreatment();
                delete $scope.treatment._manualAdditionalInstructions;
                $scope.formInvalid = false;
                clearHighlights();
                markVariable("startNewDrugEntry");
                syncAdditionalInstructions();
            };

            $scope.openActionLink = function (extension) {
                var url, location;
                locationService.getLoggedInLocation().then(function (response) {
                    location = response.name;
                    url = extension.url
                        .replace("{{patient_ref}}", $scope.patient.identifier)
                        .replace("{{location_ref}}", location);
                    $window.open(url, "_blank");
                });
            };

            $scope.toggleTabIndexWithinModal = function (event) {
                var buttonsToFocusOn = ["modal-revise-button", "modal-refill-button"];
                var focusedButton = event.target;
                focusedButton.tabIndex = 1;

                buttonsToFocusOn.splice(buttonsToFocusOn.indexOf(focusedButton.id), 1);
                var otherButton = buttonsToFocusOn[0];
                $("#" + otherButton)[0].tabIndex = 2;
            };

            $scope.toggleDrugOrderAttribute = function (orderAttribute) {
                orderAttribute.value = orderAttribute.value ? false : true;
            };
            contextChangeHandler.add(contextChange);

            var getActiveDrugOrders = function (activeDrugOrders) {
                var activeDrugOrdersList = activeDrugOrders || [];
                return activeDrugOrdersList.map(function (drugOrder) {
                    return DrugOrderViewModel.createFromContract(drugOrder, treatmentConfig);
                });
            };

            var removeOrder = function (removableOrder) {
                removableOrder.action = Bahmni.Clinical.Constants.orderActions.discontinue;
                removableOrder.previousOrderUuid = removableOrder.uuid;
                removableOrder.uuid = undefined;
                $scope.consultation.removableDrugs.push(removableOrder);
            };

            var saveTreatment = function () {
                var tabNames = Object.keys($scope.consultation.newlyAddedTabTreatments || {});
                var allTreatmentsAcrossTabs = _.flatten(_.map(tabNames, function (tabName) {
                    return $scope.consultation.newlyAddedTabTreatments[tabName].treatments;
                }));
                var orderSetTreatmentsAcrossTabs = _.flatten(_.map(tabNames, function (tabName) {
                    return $scope.consultation.newlyAddedTabTreatments[tabName].orderSetTreatments;
                }));
                var includedOrderSetTreatments = _.filter(orderSetTreatmentsAcrossTabs, function (treatment) {
                    return treatment.orderSetUuid ? treatment.include : true;
                });
                $scope.consultation.newlyAddedTreatments = allTreatmentsAcrossTabs.concat(includedOrderSetTreatments);
                if ($scope.consultation.discontinuedDrugs) {
                    $scope.consultation.discontinuedDrugs.forEach(function (discontinuedDrug) {
                        var removableOrder = _.find(activeDrugOrders, {uuid: discontinuedDrug.uuid});
                        if (discontinuedDrug) {
                            removableOrder.orderReasonText = discontinuedDrug.orderReasonText;
                            removableOrder.dateActivated = null;
                            removableOrder.scheduledDate = discontinuedDrug.dateStopped;
                            removableOrder.dateStopped = discontinuedDrug.dateStopped;

                            if (discontinuedDrug.orderReasonConcept && discontinuedDrug.orderReasonConcept.name) {
                                removableOrder.orderReasonConcept = {
                                    name: discontinuedDrug.orderReasonConcept.name.name,
                                    uuid: discontinuedDrug.orderReasonConcept.uuid
                                };
                            }
                        }
                        if (removableOrder) {
                            removeOrder(removableOrder);
                        }
                    });
                }
            };

            var putCalculatedDose = function (orderTemplate) {
                var visitUuid = treatmentConfig.orderSet.calculateDoseOnlyOnCurrentVisitValues ? $scope.activeVisit.uuid : undefined;
                var calculatedDose = orderSetService.getCalculatedDose(
                    $scope.patient.uuid,
                    orderTemplate.concept.name,
                    orderTemplate.dosingInstructions.dose,
                    orderTemplate.dosingInstructions.doseUnits,
                    $scope.newOrderSet.name,
                    orderTemplate.dosingInstructions.dosingRule,
                    visitUuid
                );
                if (calculatedDose.$$state.status == 0) $scope.isSearchDisabled = false;
                return calculatedDose.then(function (calculatedDosage) {
                    orderTemplate.dosingInstructions.dose = calculatedDosage.dose;
                    orderTemplate.dosingInstructions.doseUnits = calculatedDosage.doseUnit;
                    return orderTemplate;
                });
            };

            var deleteDrugIfEmpty = function (template) {
                if (_.isEmpty(template.drug)) {
                    delete template.drug; // _.isEmpty({}) is true.
                }
            };

            var setUpOrderSetTransactionalData = function (orderSetMember) {
                orderSetMember.orderTemplateMetaData = orderSetMember.orderTemplate;
                orderSetMember.orderTemplate = JSON.parse(orderSetMember.orderTemplate);
                orderSetMember.orderTemplate.concept = {
                    name: orderSetMember.concept.display,
                    uuid: orderSetMember.concept.uuid
                };
                deleteDrugIfEmpty(orderSetMember.orderTemplate);
            };
            var calculateDoseForTemplatesIn = function (orderSet) {
                $scope.newOrderSet.name = orderSet.name;
                var orderSetMemberTemplates = _.map(orderSet.orderSetMembers, 'orderTemplate');
                var promisesToCalculateDose = _.map(orderSetMemberTemplates, putCalculatedDose);
                var returnOrderSet = function () { return orderSet; };
                return $q.all(promisesToCalculateDose).then(returnOrderSet);
            };
            var createDrugOrderViewModel = function (orderTemplate) {
                orderTemplate.effectiveStartDate = $scope.newOrderSet.date;
                var drugOrder = Bahmni.Clinical.DrugOrder.create(orderTemplate);
                var drugOrderViewModel = Bahmni.Clinical.DrugOrderViewModel.createFromContract(drugOrder, treatmentConfig);
                drugOrderViewModel.instructions = orderTemplate.administrationInstructions;
                drugOrderViewModel.additionalInstructions = orderTemplate.additionalInstructions;
                drugOrderViewModel.isNewOrderSet = true;
                drugOrderViewModel.dosingInstructionType = Bahmni.Clinical.Constants.flexibleDosingInstructionsClass;
                drugOrderViewModel.quantity = drugOrderViewModel.quantity || 0;
                drugOrderViewModel.calculateDurationUnit();
                drugOrderViewModel.calculateQuantityAndUnit();
                drugOrderViewModel.calculateEffectiveStopDate();
                drugOrderViewModel.setUniformDoseFraction();
                return drugOrderViewModel;
            };

            var setSortWeightForOrderSetDrugs = function (orderSetDrugs) {
                _.each(orderSetDrugs, function (drugOrder, index) {
                    if (drugOrder.sortWeight !== undefined) {
                        drugOrder.sortWeight = drugOrder.sortWeight + orderSetDrugs.length;
                    } else {
                        drugOrder.sortWeight = index + 1;
                    }
                });
            };

            var createDrugOrdersAndGetConflicts = function (orderSet) {
                var conflictingDrugOrders = [];
                var orderSetMemberTemplates = _.map(orderSet.orderSetMembers, 'orderTemplate');
                _.each(orderSetMemberTemplates, function (orderTemplate) {
                    var drugOrderViewModel = createDrugOrderViewModel(orderTemplate);
                    drugOrderViewModel.orderSetUuid = orderSet.uuid;
                    var conflictingDrugOrder = getConflictingDrugOrder(drugOrderViewModel);
                    if (!conflictingDrugOrder) {
                        drugOrderViewModel.include = true;
                    } else {
                        conflictingDrugOrders.push(conflictingDrugOrder);
                    }
                    $scope.orderSetTreatments.push(drugOrderViewModel);
                });
                setSortWeightForOrderSetDrugs($scope.orderSetTreatments);
                return conflictingDrugOrders;
            };
            var showConflictMessageIfAny = function (conflictingDrugOrders) {
                if (_.isEmpty(conflictingDrugOrders)) {
                    return;
                }
                _.each($scope.orderSetTreatments, function (orderSetDrugOrder) {
                    orderSetDrugOrder.include = false;
                });
                ngDialog.open({
                    template: 'consultation/views/treatmentSections/conflictingOrderSet.html',
                    data: {'conflictingDrugOrders': conflictingDrugOrders}
                });
                $scope.popupActive = true;
            };
            $scope.addOrderSet = function (orderSet) {
                $scope.isSearchDisabled = true;
                scrollTop();
                var setUpNewOrderSet = function () {
                    $scope.newOrderSet.name = orderSet.name;
                    $scope.newOrderSet.uuid = orderSet.uuid;
                    $scope.isSearchDisabled = true;
                };
                calculateDoseForTemplatesIn(orderSet)
                    .then(createDrugOrdersAndGetConflicts)
                    .then(showConflictMessageIfAny)
                    .then(setUpNewOrderSet);
            };

            $scope.removeOrderSet = function () {
                $scope.isSearchDisabled = false;
                delete $scope.newOrderSet.name;
                delete $scope.newOrderSet.uuid;
                $scope.orderSetTreatments.splice(0, $scope.orderSetTreatments.length);
            };

            $scope.$on("event:includeOrderSetDrugOrder", function (event, drugOrder) {
                var conflictingDrugOrder = getConflictingDrugOrder(drugOrder);
                if (conflictingDrugOrder) {
                    drugOrder.include = false;
                    ngDialog.open({
                        template: 'consultation/views/treatmentSections/conflictingOrderSet.html',
                        data: {'conflictingDrugOrders': [conflictingDrugOrder]}
                    });
                    $scope.popupActive = true;
                }
            });

            $scope.consultation.preSaveHandler.register("drugOrderSaveHandlerKey", saveTreatment);

            var mergeActiveAndScheduledWithDiscontinuedOrders = function () {
                _.each($scope.consultation.discontinuedDrugs, function (discontinuedDrug) {
                    _.remove($scope.consultation.activeAndScheduledDrugOrders, {'uuid': discontinuedDrug.uuid});
                    $scope.consultation.activeAndScheduledDrugOrders.push(discontinuedDrug);
                });
            };

            var getDU = function(){
                $scope.DU = [];
                drugService.DU(duURL).then(function (DU) {
                    DU.forEach(element => {
                        $scope.DU.push(element);
                    });
                });
            }
            $scope.getStock = function () {
                $scope.stock = [];
                $scope.stockQuantity = "";
                if ($scope.treatment.drug != undefined && $scope.DispensingUnit != undefined) {
                    var itemUUID = $scope.treatment.drug.uuid;
                    drugService.stockPerItem(itemStockURL, $scope.DispensingUnit, itemUUID)
                    .then(function(stockPerItem){
                        $scope.hasStock = stockPerItem!=null && stockPerItem!=undefined ? stockPerItem.hasStock : "";
                        var drugName = document.getElementById("drug-name");
                        if ($scope.hasStock) {
                            drugName.style.background = "#90EE90"
                        }
                        else {
                            drugName.style.background = "#FFCCCB"
                        }
                        $scope.stockQuantity = stockPerItem!=null && stockPerItem!=undefined ? stockPerItem.quantity : 0;
                        var stockQuantity = document.getElementById("stockQuantity");
                        var stockQuantityDiv = document.getElementById("stockQuantityDiv");
                        stockQuantityDiv.style.display = "block";
                        stockQuantity.value = $scope.stockQuantity;
                    });
                }
                else {
                    if ($scope.DispensingUnit != undefined) {
                        drugService.stock(stockURL,$scope.DispensingUnit)
                        .then(function (stock) {
                            if (stock != undefined) {
                                stock.forEach(element => {
                                    $scope.stock.push(element);
                                });
                            }
                        });
                    }
                }
            }
            $scope.allowStock = function () {
                $window.open("https://172.16.0.13:1337/du");
            }

            $scope.toggleMedicalSupply = function (treatment) {
                treatment.isMedicalSupply = !treatment.isMedicalSupply;
                if (treatment.isMedicalSupply) {
                    treatment.uniformDosingType.frequency = "No Frequency";
                    treatment.route = "No Route";
                    treatment.duration = 1;
                    treatment.durationUnit = "Day(s)";
                }else{
                    treatment.uniformDosingType.frequency = null;
                    treatment.route = null;
                }
            };



            var init = function () {
                $scope.consultation.removableDrugs = $scope.consultation.removableDrugs || [];
                $scope.consultation.discontinuedDrugs = $scope.consultation.discontinuedDrugs || [];
                $scope.consultation.drugOrdersWithUpdatedOrderAttributes = $scope.consultation.drugOrdersWithUpdatedOrderAttributes || {};
                $scope.consultation.activeAndScheduledDrugOrders = getActiveDrugOrders(activeDrugOrders);

                mergeActiveAndScheduledWithDiscontinuedOrders();
                getDU();
                $scope.treatmentConfig = treatmentConfig;// $scope.treatmentConfig used only in UI
            };
            init();
        }]);
