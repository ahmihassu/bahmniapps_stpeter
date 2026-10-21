'use strict';

angular.module('bahmni.clinical')
    .controller('BacteriologyController', ['$scope', '$rootScope', '$timeout', '$q', 'contextChangeHandler', 'spinner', 'conceptSetService',
        'messagingService', 'bacteriologyConceptSet', 'appService', 'retrospectiveEntryService',
        function ($scope, $rootScope, $timeout, $q, contextChangeHandler, spinner, conceptSetService, messagingService, bacteriologyConceptSet,
                  appService, retrospectiveEntryService) {
            $scope.consultation.extensions = $scope.consultation.extensions ? $scope.consultation.extensions : {mdrtbSpecimen: []};
            var initializeBacteriologyScope = function () {
                $scope.savedSpecimens = $scope.consultation.savedSpecimens || $scope.consultation.extensions.mdrtbSpecimen;
                $scope.newSpecimens = $scope.consultation.newlyAddedSpecimens || [];
                $scope.deletedSpecimens = $scope.consultation.deletedSpecimens || [];

                $timeout(function () {
                    if (typeof hydrateSpecimenMetadata === "function") {
                        hydrateSpecimenMetadata($scope.savedSpecimens || []);
                        hydrateSpecimenMetadata($scope.newSpecimens || []);
                    }
                }, 0);
            };

            initializeBacteriologyScope();

            $scope.orderCategoryOptions = [];
            $scope.orderTypeOptionsByCategory = {};
            $scope.pathologyTechniqueOptions = [];
            $scope.specialOrderTypeConcepts = [];
            $scope.requestFormConcepts = [];
            var orderCategoryConceptMap = {};
            var normalizeConfigKey = function (value) {
                return (value || "").toString().toLowerCase().trim();
            };
            var toNormalizedConfigMap = function (rawMap) {
                return _.reduce(rawMap || {}, function (acc, value, key) {
                    acc[normalizeConfigKey(key)] = value;
                    return acc;
                }, {});
            };
            var configuredTypeToLegacyClassMap = toNormalizedConfigMap(
                appService.getAppDescriptor().getConfigValue("specialOrderTypeToLegacySampleClassMap")
            );
            var configuredTypeToFormConceptMap = toNormalizedConfigMap(
                appService.getAppDescriptor().getConfigValue("specialOrderTypeToFormConceptMap")
            );
            var configuredTypeToResultFormConceptMap = toNormalizedConfigMap(
                appService.getAppDescriptor().getConfigValue("specialOrderTypeToResultFormConceptMap")
            );
            var configuredSpecialOrderButtonStyles = appService.getAppDescriptor().getConfigValue("specialOrderButtonStyles") || {};
            var defaultSpecialOrderButtonStyles = {
                base: {
                    "min-width": "120px",
                    "margin-right": "6px",
                    "margin-bottom": "6px",
                    "white-space": "normal",
                    "display": "inline-flex",
                    "align-items": "center",
                    "justify-content": "center",
                    "float": "none",
                    "flex": "0 0 auto",
                    "max-width": "100%"
                },
                active: {}
            };

            $scope.isRetrospectiveMode = function () {
                return !_.isEmpty(retrospectiveEntryService.getRetrospectiveEntry());
            };

            var init = function () {
                if (appService.getAppDescriptor().getConfigValue("showSaveConfirmDialog")) {
                    $scope.$broadcast("event:pageUnload");
                }
                var additionalAttributes = _.find(bacteriologyConceptSet.setMembers, function (member) {
                    return member.conceptClass.name === "Bacteriology Attributes";
                });
                $scope.additionalAttributesConceptName = additionalAttributes && additionalAttributes.name.name;

                var results = _.find(bacteriologyConceptSet.setMembers, function (member) {
                    return member.conceptClass.name === "Bacteriology Results";
                });
                $scope.resultsConceptName = results && results.name.name;

                var sampleSource = _.find(bacteriologyConceptSet.setMembers, function (member) {
                    return member.name.name === "Specimen Sample Source";
                });
                $scope.allSamples = sampleSource !== undefined && _.map(sampleSource.answers, function (answer) {
                    return new Bahmni.Common.Domain.ConceptMapper().map(answer);
                });
                initializeSpecialOrderOptions().then(function () {
                    hydrateSpecimenMetadata($scope.savedSpecimens || []);
                    hydrateSpecimenMetadata($scope.newSpecimens || []);
                });
                if ($scope.savedSpecimens) {
                    $scope.savedSpecimens = _.sortBy($scope.savedSpecimens, 'dateCollected').reverse();
                }
                if ($scope.newSpecimens.length === 0) {
                    $scope.createNewSpecimen();
                }
                if ($scope.isUserPrivilegedToEnterResult()) {
                    scheduleReportConditions();
                }
                handleSampleTypeOther();
                scheduleFormConditions();
                $scope.$watch(function () {
                    return _.map($scope.newSpecimens || [], function (specimen) {
                        var techniqueFromForm = null;
                        try {
                            techniqueFromForm = getTechniqueValueFromAnyObservation(specimen) ||
                                getObservationValueByConceptNames(specimen, pathologyTechniqueConceptNames);
                        } catch (e) {
                            techniqueFromForm = null;
                        }
                        return [
                            specimen && specimen.orderCategory,
                            specimen && specimen.orderType,
                            specimen && specimen.pathologyTechnique,
                            techniqueFromForm,
                            specimen && specimen.identifier,
                            getSpecimenTypeName(specimen)
                        ].join("|");
                    }).join("||");
                }, function () {
                    var specimens = $scope.newSpecimens || [];
                    if (!specimens.length) {
                        return;
                    }
                    _.forEach(specimens, function (specimen) {
                        if (!$scope.isPathologyCategory(specimen && specimen.orderCategory)) {
                            return;
                        }
                        var techniqueFromForm = getTechniqueValueFromAnyObservation(specimen) ||
                            getObservationValueByConceptNames(specimen, pathologyTechniqueConceptNames);
                        if (techniqueFromForm && normalizeText(techniqueFromForm) !== normalizeText(specimen.pathologyTechnique)) {
                            specimen.pathologyTechnique = techniqueFromForm;
                        }
                    });
                });
            };

            $scope.isUserPrivilegedToEnterResult = function () {
                var bacteriologyResultPrivilege = Bahmni.Clinical.Constants.bacteriologyResultPrivilege;
                var hasPrivilege = _.filter($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name === bacteriologyResultPrivilege;
                });
                return hasPrivilege.length > 0;
            };

            var hasPrivilegeByName = function (expectedPrivilegeName) {
                if (!expectedPrivilegeName || !$rootScope.currentUser || !$rootScope.currentUser.privileges) {
                    return false;
                }
                var want = expectedPrivilegeName.toLowerCase().trim();
                var hasPrivilege = _.filter($rootScope.currentUser.privileges, function (privilege) {
                    var privilegeName = privilege && privilege.name ? privilege.name.toLowerCase().trim() : "";
                    return privilegeName === want;
                });
                return hasPrivilege.length > 0;
            };

            $scope.isUserPrivilegedToCollectSample = function () {
                return hasPrivilegeByName(Bahmni.Clinical.Constants.collectSamplePrivilege);
            };

            $scope.isUserPrivilegedToEditSpecialOrder = function () {
                return hasPrivilegeByName(Bahmni.Clinical.Constants.editSpecialOrderPrivilege);
            };

            $scope.canEditRequestSection = function (specimen) {
                if ($scope.isRetrospectiveMode()) {
                    return false;
                }
                if (specimen && (specimen.voided || specimen.cancelled)) {
                    return false;
                }
                if (specimen && !specimen.isExistingSpecimen()) {
                    return true;
                }
                return $scope.isUserPrivilegedToCollectSample() || $scope.isUserPrivilegedToEditSpecialOrder();
            };

            $scope.canEditResultSection = function () {
                return $scope.isUserPrivilegedToEnterResult() && !$scope.isRetrospectiveMode();
            };

            $scope.canShowCancelOrderButton = function (specimen) {
                var identifierText = (specimen && specimen.identifier || "").toString().toLowerCase().trim();
                if (!specimen || specimen.voided || specimen.cancelled || $scope.isRetrospectiveMode()) {
                    return false;
                }
                if (identifierText.indexOf("cancelled") === 0 || identifierText.indexOf("order cancelled") === 0) {
                    return false;
                }
                if (specimen.identifier) {
                    return false;
                }
                var isPersistedSpecimen = !!(specimen.uuid || specimen.existingObs);
                return isPersistedSpecimen && $scope.isUserPrivilegedToCollectSample();
            };

            var getAutoOrderRequestDate = function () {
                return Bahmni.Common.Util.DateUtil.getDateWithoutTime(Bahmni.Common.Util.DateUtil.now());
            };

            $scope.createNewSpecimen = function () {
                var newSpecimen = new Bahmni.Clinical.Specimen(null, $scope.allSamples);
                newSpecimen.orderCategory = null;
                newSpecimen.orderType = null;
                newSpecimen.pathologyTechnique = null;
                newSpecimen.dateCollected = getAutoOrderRequestDate();
                $scope.newSpecimens.push(newSpecimen);
            };

            $scope.sampleCollected = function (specimen) {
                var specimenIdentifierText = (specimen && specimen.identifier || "").toString().toLowerCase().trim();
                if (specimen && (specimen.cancelled || specimenIdentifierText.indexOf("cancelled") === 0 || specimenIdentifierText.indexOf("order cancelled") === 0)) {
                    specimen.collectionLabel = 'ORDER CANCELLED';
                    return;
                }

                if (specimen) {
                    specimen.showCancelReasonInput = false;
                    specimen.cancelReasonDraft = "";
                }
                specimen.identifier = specimen.identifier ? null : 'Collected'
                specimen.collectionLabel = specimen.identifier ? 'SAMPLE COLLECTED ✔' : 'COLLECT SAMPLE'
            }

            var contextChange = function () {
                $scope.consultation.newlyAddedSpecimens = $scope.newSpecimens;
                $scope.consultation.deletedSpecimens = $scope.deletedSpecimens;
                $scope.consultation.savedSpecimens = $scope.savedSpecimens;
                var dirtySpecimens = _.filter($scope.newSpecimens, function (specimen) {
                    return (specimen.isDirty());
                });
                _.each(dirtySpecimens, function (dirtySpecimen) {
                    dirtySpecimen.hasIllegalDateCollected = !dirtySpecimen.dateCollected;
                    dirtySpecimen.hasIllegalType = !dirtySpecimen.type;
                    dirtySpecimen.hasIllegalTypeFreeText = !dirtySpecimen.typeFreeText;
                });
                return {allow: dirtySpecimens[0] === undefined};
            };

            var saveSpecimens = function () {
                var savableSpecimens = _.filter($scope.newSpecimens, function (specimen) {
                    return !specimen.isEmpty() || specimen.voidIfEmpty();
                });

                savableSpecimens = savableSpecimens.concat($scope.deletedSpecimens);
                var specimenMapper = new Bahmni.Clinical.SpecimenMapper();
                var specimens = [];

                var walkGroupMembers = function (groupMembers, visitorFn) {
                    if (!groupMembers || !groupMembers.length) {
                        return;
                    }
                    _.forEach(groupMembers, function (member) {
                        visitorFn(member);
                        if (member.groupMembers && member.groupMembers.length) {
                            walkGroupMembers(member.groupMembers, visitorFn);
                        }
                    });
                };

                var findRequestObservationByConceptName = function (specimen, conceptName) {
                    var attributesRoot = specimen &&
                        specimen.sample &&
                        specimen.sample.additionalAttributes &&
                        specimen.sample.additionalAttributes[0];
                    var found = null;
                    if (!attributesRoot || !attributesRoot.groupMembers) {
                        return null;
                    }
                    walkGroupMembers(attributesRoot.groupMembers, function (member) {
                        if (found) {
                            return;
                        }
                        var memberConceptName = getObservationConceptName(member);
                        if (memberConceptName && normalizeText(memberConceptName) === normalizeText(conceptName)) {
                            found = member;
                        }
                    });
                    return found;
                };

                var setObservationNodeValue = function (observationNode, rawValue) {
                    if (!observationNode || rawValue === null || rawValue === undefined) {
                        return;
                    }
                    try {
                        var getAnswerDisplay = function (answer) {
                            if (!answer) {
                                return null;
                            }
                            if (answer.displayString) {
                                return answer.displayString;
                            }
                            if (answer.display) {
                                return answer.display;
                            }
                            if (answer.name && angular.isObject(answer.name) && answer.name.name) {
                                return answer.name.name;
                            }
                            return answer.name || null;
                        };
                        if (observationNode.getPossibleAnswers) {
                            var possibleAnswers = observationNode.getPossibleAnswers() || [];
                            var matchingAnswer = _.find(possibleAnswers, function (answer) {
                                var answerName = getAnswerDisplay(answer);
                                return answerName && normalizeText(answerName) === normalizeText(rawValue);
                            });
                            // For coded observations, prefer setting the coded answer object.
                            // If we cannot match, keep current value instead of forcing invalid raw text.
                            if (matchingAnswer) {
                                observationNode.value = matchingAnswer;
                            } else if (!observationNode.primaryObs || observationNode.primaryObs.getDataTypeName() !== "Coded") {
                                observationNode.value = rawValue;
                            }
                            return;
                        }
                        observationNode.value = rawValue;
                    } catch (e) {
                        console.error("[SpecialOrders][Bacteriology] Unable to set observation value", {
                            conceptName: observationNode && observationNode.concept && observationNode.concept.name,
                            value: rawValue,
                            error: e && e.message
                        });
                    }
                };

                var getObservationNodeValue = function (observationNode) {
                    if (!observationNode) {
                        return null;
                    }
                    var rawValue = observationNode.value;
                    if (_.isArray(rawValue) && rawValue.length) {
                        rawValue = rawValue[0];
                    }
                    if (rawValue && rawValue.name && angular.isObject(rawValue.name) && rawValue.name.name) {
                        return rawValue.name.name;
                    }
                    if (rawValue && rawValue.name) {
                        return rawValue.name;
                    }
                    if (rawValue && rawValue.displayString) {
                        return rawValue.displayString;
                    }
                    return rawValue || null;
                };

                var syncRequestMetadataToObservations = function (specimen) {
                    var resolvedTypeName = getSpecimenTypeName(specimen);
                    if (!resolvedTypeName && specimen.orderType) {
                        resolvedTypeName = angular.isObject(specimen.orderType) ?
                            (specimen.orderType.name && specimen.orderType.name.name ? specimen.orderType.name.name : specimen.orderType.name) :
                            specimen.orderType;
                    }
                    var resolvedCategory = specimen.orderCategory || getOrderCategoryByTypeName(resolvedTypeName);
                    if (!specimen.orderCategory && resolvedCategory) {
                        specimen.orderCategory = resolvedCategory;
                    }

                    var orderCategoryObs = findRequestObservationByConceptName(specimen, "Order Category");
                    var pathologyTechniqueObs = findRequestObservationByConceptName(specimen, pathologyTechniqueConceptNames[0]) ||
                        findRequestObservationByConceptName(specimen, pathologyTechniqueConceptNames[1]);
                    setObservationNodeValue(orderCategoryObs, resolvedCategory || specimen.orderCategory);

                    // If technique was selected in UI, persist it; if UI value is empty but request form
                    // already has a value, mirror it back to specimen to avoid losing it in save logs/payload.
                    if (specimen.pathologyTechnique) {
                        setObservationNodeValue(pathologyTechniqueObs, specimen.pathologyTechnique);
                    } else {
                        var existingTechniqueValue = getObservationNodeValue(pathologyTechniqueObs);
                        if (existingTechniqueValue) {
                            specimen.pathologyTechnique = existingTechniqueValue;
                        }
                    }

                    // Final defensive normalization to avoid null values in save payload/logs.
                    if (!specimen.orderCategory && resolvedTypeName) {
                        specimen.orderCategory = getOrderCategoryByTypeName(resolvedTypeName);
                    }
                    if (!specimen.pathologyTechnique) {
                        specimen.pathologyTechnique = getObservationNodeValue(pathologyTechniqueObs) || specimen.pathologyTechnique;
                    }
                };

                _.each(savableSpecimens, function (specimen) {
                    syncRequestMetadataToObservations(specimen);
                    var topLevelMembers = getRequestGroupMembers(specimen) || [];
                    var typeName = getSpecimenTypeName(specimen) || specimen.orderType;
                    if (typeName && topLevelMembers.length) {
                        var targetFormName = getMappedRequestFormConceptForType(specimen, topLevelMembers);
                        applyRequestFormVisibility(specimen, targetFormName);
                    }
                    specimens.push(specimenMapper.mapSpecimenToObservation(specimen));
                });

                $scope.consultation.newlyAddedSpecimens = specimens;
                if (!$scope.consultation.extensions.mdrtbSpecimen) {
                    $scope.consultation.extensions.mdrtbSpecimen = [];
                }
            };

            $scope.editSpecimen = function (specimen) {
                $scope.savedSpecimens = _.without($scope.savedSpecimens, specimen);
                var editableSpecimen = new Bahmni.Clinical.Specimen(specimen, $scope.allSamples);
                var resolvedTypeName = getSpecimenTypeName(editableSpecimen) || editableSpecimen.orderType;

                // Preserve request metadata while converting saved specimen -> editable specimen.
                editableSpecimen.orderType = specimen.orderType || resolvedTypeName || null;
                editableSpecimen.orderCategory = specimen.orderCategory ||
                    getObservationValueByConceptName(editableSpecimen, "Order Category") ||
                    getOrderCategoryByTypeName(editableSpecimen.orderType || resolvedTypeName);
                editableSpecimen.pathologyTechnique = specimen.pathologyTechnique ||
                    getObservationValueByConceptNames(editableSpecimen, pathologyTechniqueConceptNames) ||
                    getTechniqueValueFromAnyObservation(editableSpecimen) ||
                    null;

                $scope.newSpecimens.push(editableSpecimen);
                hydrateSpecimenMetadata([editableSpecimen]);

                handleSampleTypeOther();
                scheduleFormConditions();
                if ($scope.isUserPrivilegedToEnterResult()) {
                    scheduleReportConditions();
                }
            };

            $scope.handleUpdate = function () {
                _.forEach($scope.newSpecimens || [], function (specimen) {
                    if (!$scope.isPathologyCategory(specimen && specimen.orderCategory)) {
                        return;
                    }
                    var selectedTechnique = getObservationValueByConceptNames(specimen, pathologyTechniqueConceptNames) ||
                        getTechniqueValueFromAnyObservation(specimen) ||
                        null;
                    specimen.pathologyTechnique = selectedTechnique;
                });
                handleSampleTypeOther();
                scheduleFormConditions();
            };

            var getTypeConceptByOrderType = function (orderType) {
                if (!orderType || !$scope.specialOrderTypeConcepts) {
                    return null;
                }
                return _.find($scope.specialOrderTypeConcepts, function (sample) {
                    var sampleDisplay = sample.displayString || sample.name || sample.shortName || getConceptDisplayName(sample);
                    return sampleDisplay === orderType ||
                        (sampleDisplay && sampleDisplay.toLowerCase() === orderType.toLowerCase());
                }) || null;
            };

            var getOrderCategoryConceptByName = function (categoryName) {
                if (!categoryName) {
                    return null;
                }
                return orderCategoryConceptMap[normalizeText(categoryName)] || null;
            };

            var walkGroupMembers = function (groupMembers, visitorFn) {
                if (!groupMembers || !groupMembers.length) {
                    return;
                }
                _.forEach(groupMembers, function (member) {
                    visitorFn(member);
                    if (member.groupMembers && member.groupMembers.length) {
                        walkGroupMembers(member.groupMembers, visitorFn);
                    }
                });
            };

            var getObservationValueByConceptName = function (specimen, conceptName) {
                var attributesRoot = specimen &&
                    specimen.sample &&
                    specimen.sample.additionalAttributes &&
                    specimen.sample.additionalAttributes[0];
                if (!attributesRoot || !attributesRoot.groupMembers) {
                    return null;
                }
                var foundValue = null;
                walkGroupMembers(attributesRoot.groupMembers, function (member) {
                    var memberConceptName = getObservationConceptName(member);
                    if (memberConceptName && normalizeText(memberConceptName) === normalizeText(conceptName)) {
                        var memberValue = getRawObservationValueText(member.value);
                        if (memberValue !== null && memberValue !== undefined && memberValue !== "") {
                            // Multiple technique concepts can exist in form tree; keep latest non-empty value.
                            foundValue = memberValue;
                        }
                    }
                });
                return foundValue;
            };

            var getObservationValueByConceptNames = function (specimen, conceptNames) {
                var resolvedValue = null;
                _.some(conceptNames || [], function (conceptName) {
                    resolvedValue = getObservationValueByConceptName(specimen, conceptName);
                    return !!resolvedValue;
                });
                return resolvedValue;
            };

            var getRawObservationValueText = function (rawValue) {
                if (_.isArray(rawValue) && rawValue.length) {
                    rawValue = rawValue[0];
                }
                if (rawValue && rawValue.name && angular.isObject(rawValue.name) && rawValue.name.name) {
                    return rawValue.name.name;
                }
                if (rawValue && rawValue.name) {
                    return rawValue.name;
                }
                if (rawValue && rawValue.displayString) {
                    return rawValue.displayString;
                }
                return rawValue || null;
            };

            var getTechniqueValueFromAnyObservation = function (specimen) {
                var attributesRoot = specimen &&
                    specimen.sample &&
                    specimen.sample.additionalAttributes &&
                    specimen.sample.additionalAttributes[0];
                if (!attributesRoot || !attributesRoot.groupMembers || !$scope.pathologyTechniqueOptions.length) {
                    return null;
                }
                var optionMap = _.reduce($scope.pathologyTechniqueOptions, function (acc, option) {
                    acc[normalizeText(option)] = option;
                    return acc;
                }, {});
                var resolvedTechnique = null;
                walkGroupMembers(attributesRoot.groupMembers, function (member) {
                    if (resolvedTechnique) {
                        return;
                    }
                    var rawText = getRawObservationValueText(member && member.value);
                    if (rawText && optionMap[normalizeText(rawText)]) {
                        resolvedTechnique = optionMap[normalizeText(rawText)];
                    }
                });
                return resolvedTechnique;
            };

            var hydrateSpecimenMetadata = function (specimens) {
                _.forEach(specimens || [], function (specimen) {
                    var identifierText = (specimen && specimen.identifier || "").toString().toLowerCase().trim();
                    if (identifierText.indexOf("cancelled") === 0 || identifierText.indexOf("order cancelled") === 0) {
                        specimen.cancelled = true;
                        specimen.cancellationReason = specimen.cancellationReason ||
                            (specimen.identifier && specimen.identifier.split(":").slice(1).join(":").trim()) ||
                            specimen.voidedReason ||
                            null;
                    }
                    if (specimen && specimen.dateCollected) {
                        specimen.dateCollected = Bahmni.Common.Util.DateUtil.getDateWithoutTime(specimen.dateCollected);
                    }
                    if (specimen && !specimen.isExistingSpecimen() && !specimen.dateCollected) {
                        specimen.dateCollected = getAutoOrderRequestDate();
                    }
                    var typeName = getSpecimenTypeName(specimen) || specimen.orderType;
                    if (typeName && !specimen.orderType) {
                        specimen.orderType = typeName;
                    }
                    if (!specimen.orderCategory && typeName) {
                        specimen.orderCategory = getOrderCategoryByTypeName(typeName);
                    }
                    if (!specimen.orderCategory) {
                        specimen.orderCategory = getObservationValueByConceptName(specimen, "Order Category") || specimen.orderCategory;
                    }
                    if (!specimen.pathologyTechnique) {
                        specimen.pathologyTechnique = getObservationValueByConceptNames(specimen, pathologyTechniqueConceptNames) ||
                            getTechniqueValueFromAnyObservation(specimen) ||
                            specimen.pathologyTechnique;
                    }
                    specimen.cancelled = specimen.cancelled || ((specimen.identifier || "").toString().toLowerCase().trim().indexOf("cancelled") === 0);
                    specimen.collectionLabel = specimen.cancelled ? 'ORDER CANCELLED' :
                        (specimen.identifier ? 'SAMPLE COLLECTED ✔' : 'COLLECT SAMPLE');
                });
            };

            var getOrderCategoryByTypeName = function (typeName) {
                if (!typeName) {
                    return null;
                }
                var normalizedTypeName = normalizeText(typeName);
                var matchedCategory = _.find($scope.orderCategoryOptions, function (category) {
                    var categoryOptions = $scope.orderTypeOptionsByCategory[category] || [];
                    return _.some(categoryOptions, function (option) {
                        return normalizeText(option) === normalizedTypeName;
                    });
                });
                if (matchedCategory) {
                    return matchedCategory;
                }
                return null;
            };

            var getConceptSetMemberByName = function (conceptName) {
                return _.find(bacteriologyConceptSet.setMembers, function (member) {
                    return member && member.name && member.name.name === conceptName;
                });
            };

            var fetchConceptByName = function (conceptName) {
                return conceptSetService.getConcept({
                    name: conceptName,
                    v: "custom:(uuid,name,conceptClass,answers:(uuid,name,conceptClass,answers:(uuid,name,conceptClass),setMembers:(uuid,name,conceptClass)))"
                }, true).then(function (response) {
                    return response && response.data && response.data.results && response.data.results[0];
                }, function () {
                    return null;
                });
            };

            var getAnswerNamesFromMember = function (member) {
                if (!member || !member.answers) {
                    return [];
                }
                return _.chain(member.answers)
                    .map(function (answer) {
                        if (!answer) {
                            return null;
                        }
                        return answer.displayString || (answer.name && answer.name.name);
                    })
                    .filter(function (value) {
                        return !!value;
                    })
                    .uniq()
                    .value();
            };

            var getCategoryForOrderType = function (answer) {
                if (!answer || !answer.conceptClass) {
                    return null;
                }
                if (angular.isString(answer.conceptClass)) {
                    return answer.conceptClass;
                }
                return answer.conceptClass.name || null;
            };

            var getConceptDisplayName = function (concept) {
                if (!concept) {
                    return null;
                }
                return concept.displayString || (concept.name && concept.name.name);
            };

            var getSpecimenTypeName = function (specimen) {
                if (!specimen || !specimen.type) {
                    return null;
                }
                var typeName = specimen.type.name;
                if (typeName && angular.isObject(typeName) && typeName.name) {
                    typeName = typeName.name;
                }
                return typeName || specimen.type.shortName || getConceptDisplayName(specimen.type);
            };

            var normalizeText = function (value) {
                return (value || "").toString().toLowerCase().trim();
            };
            var pathologyTechniqueConceptNames = ["Pathology Technique", "Type of Technique"];

            var getMemberConceptClass = function (member) {
                if (!member || !member.concept || !member.concept.conceptClass) {
                    return null;
                }
                if (angular.isString(member.concept.conceptClass)) {
                    return member.concept.conceptClass;
                }
                return member.concept.conceptClass.name || null;
            };

            var getMemberConceptName = function (member) {
                if (!member || !member.concept) {
                    return null;
                }
                if (member.concept.name && member.concept.name.name) {
                    return member.concept.name.name;
                }
                return member.concept.name || member.concept.displayString || null;
            };

            var getObservationConceptName = function (member) {
                if (!member || !member.concept) {
                    return null;
                }
                if (member.concept.name && angular.isObject(member.concept.name) && member.concept.name.name) {
                    return member.concept.name.name;
                }
                return member.concept.name || member.concept.displayString || null;
            };

            var isMappedFormConceptMatch = function (memberName, mappedFormConcept) {
                var normalizedMemberName = normalizeText(memberName);
                var normalizedMappedName = normalizeText(mappedFormConcept);
                if (!normalizedMemberName || !normalizedMappedName) {
                    return false;
                }
                return normalizedMemberName === normalizedMappedName ||
                    normalizedMemberName.indexOf(normalizedMappedName) > -1 ||
                    normalizedMappedName.indexOf(normalizedMemberName) > -1;
            };

            var tokenize = function (value) {
                return _.chain(normalizeText(value).split(/[^a-z0-9]+/))
                    .filter(function (token) {
                        return token && token.length > 2 &&
                            token !== "form" && token !== "request" && token !== "sample" &&
                            token !== "type" && token !== "order" && token !== "note";
                    })
                    .uniq()
                    .value();
            };

            var inferFormConceptForType = function (typeName, groupMembers) {
                if (!typeName || !groupMembers || groupMembers.length === 0) {
                    return null;
                }
                var typeTokens = tokenize(typeName);
                if (typeTokens.length === 0) {
                    return null;
                }
                var bestMatch = null;
                var bestScore = 0;
                _.forEach(groupMembers, function (member) {
                    var memberName = getMemberConceptName(member);
                    if (!memberName) {
                        return;
                    }
                    var score = _.intersection(typeTokens, tokenize(memberName)).length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = memberName;
                    }
                });
                return bestScore > 0 ? bestMatch : null;
            };

            var scoreFormMemberAgainstReferences = function (memberName, referenceNames) {
                if (!memberName || !referenceNames || !referenceNames.length) {
                    return 0;
                }
                var bestScore = 0;
                _.forEach(referenceNames, function (referenceName) {
                    if (!referenceName) {
                        return;
                    }
                    if (isMappedFormConceptMatch(memberName, referenceName)) {
                        bestScore = Math.max(bestScore, 100);
                        return;
                    }
                    var overlap = _.intersection(tokenize(memberName), tokenize(referenceName)).length;
                    bestScore = Math.max(bestScore, overlap);
                });
                return bestScore;
            };

            var resolveBestFormMemberName = function (groupMembers, referenceNames) {
                if (!groupMembers || !groupMembers.length || !referenceNames || !referenceNames.length) {
                    return null;
                }
                var scoredMembers = [];
                _.forEach(groupMembers, function (member) {
                    var memberName = getMemberConceptName(member);
                    if (!memberName) {
                        return;
                    }
                    var score = scoreFormMemberAgainstReferences(memberName, referenceNames);
                    if (score > 0) {
                        scoredMembers.push({ name: memberName, score: score });
                    }
                });
                if (!scoredMembers.length) {
                    return null;
                }
                scoredMembers = _.sortBy(scoredMembers, function (entry) {
                    return -entry.score;
                });
                if (scoredMembers.length > 1 && scoredMembers[0].score === scoredMembers[1].score) {
                    var configuredReference = referenceNames[0];
                    var configuredMatch = _.find(scoredMembers, function (entry) {
                        return configuredReference && isMappedFormConceptMatch(entry.name, configuredReference);
                    });
                    if (configuredMatch) {
                        return configuredMatch.name;
                    }
                }
                return scoredMembers[0].name;
            };

            var getLegacySampleClassForType = function (specimen) {
                if (!specimen) {
                    return null;
                }
                var configuredLegacyClass = configuredTypeToLegacyClassMap[normalizeText(getSpecimenTypeName(specimen) || specimen.orderType)];
                if (configuredLegacyClass) {
                    return configuredLegacyClass;
                }
                if (specimen.type && specimen.type.conceptClass) {
                    var conceptClassName;
                    if (angular.isString(specimen.type.conceptClass)) {
                        conceptClassName = specimen.type.conceptClass;
                    } else if (specimen.type.conceptClass.name) {
                        conceptClassName = specimen.type.conceptClass.name;
                    }
                    if (conceptClassName) {
                        var normalizedClassName = normalizeText(conceptClassName);
                        if (normalizedClassName === "blood" || normalizedClassName === "urine" || normalizedClassName === "sputum" ||
                            normalizedClassName === "body fluid" || normalizedClassName === "tissue") {
                            return conceptClassName;
                        }
                    }
                }

                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                if (!typeName) {
                    return null;
                }
                return null;
            };

            var getConfiguredFormConceptForType = function (typeName, conceptMap) {
                var normalizedTypeName = normalizeText(typeName);
                if (!normalizedTypeName || !conceptMap) {
                    return null;
                }
                if (conceptMap[normalizedTypeName]) {
                    return conceptMap[normalizedTypeName];
                }
                var matchedKey = _.find(_.keys(conceptMap), function (configKey) {
                    return normalizedTypeName.indexOf(configKey) > -1 || configKey.indexOf(normalizedTypeName) > -1;
                });
                return matchedKey ? conceptMap[matchedKey] : null;
            };

            var resolveConfiguredFormConceptInMembers = function (configuredFormConcept, groupMembers, typeName) {
                if (!groupMembers || !groupMembers.length) {
                    return null;
                }
                var referenceNames = [];
                if (configuredFormConcept) {
                    referenceNames.push(configuredFormConcept);
                }
                if (typeName) {
                    referenceNames.push(typeName);
                }
                return resolveBestFormMemberName(groupMembers, referenceNames);
            };

            var getMappedFormConceptForType = function (specimen) {
                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                if (!typeName) {
                    return null;
                }
                return getConfiguredFormConceptForType(typeName, configuredTypeToFormConceptMap);
            };

            var hasConfiguredRequestFormForType = function (specimen) {
                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                return !!getConfiguredFormConceptForType(typeName, configuredTypeToFormConceptMap);
            };

            var getRequestGroupMembers = function (specimen) {
                return specimen &&
                    specimen.sample &&
                    specimen.sample.additionalAttributes &&
                    specimen.sample.additionalAttributes[0] &&
                    specimen.sample.additionalAttributes[0].groupMembers;
            };

            var getMappedRequestFormConceptForType = function (specimen, groupMembers) {
                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                if (!typeName || !groupMembers || !groupMembers.length) {
                    return null;
                }
                var configuredRequestForm = getConfiguredFormConceptForType(typeName, configuredTypeToFormConceptMap);
                if (configuredRequestForm) {
                    return resolveConfiguredFormConceptInMembers(configuredRequestForm, groupMembers, typeName);
                }
                return inferFormConceptForType(typeName, groupMembers);
            };

            var getResultGroupMembers = function (specimen) {
                return specimen &&
                    specimen.report &&
                    specimen.report.results &&
                    specimen.report.results[0] &&
                    specimen.report.results[0].groupMembers;
            };

            var hasConfiguredResultFormForType = function (specimen) {
                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                return !!getConfiguredFormConceptForType(typeName, configuredTypeToResultFormConceptMap);
            };

            var getMappedResultFormConceptForType = function (specimen, groupMembers) {
                var typeName = normalizeText(getSpecimenTypeName(specimen) || specimen.orderType);
                if (!typeName || !groupMembers || !groupMembers.length) {
                    return null;
                }
                var configuredResultForm = getConfiguredFormConceptForType(typeName, configuredTypeToResultFormConceptMap);
                if (configuredResultForm) {
                    return resolveConfiguredFormConceptInMembers(configuredResultForm, groupMembers, typeName);
                }
                var mappedRequestForm = getConfiguredFormConceptForType(typeName, configuredTypeToFormConceptMap);
                if (mappedRequestForm) {
                    return resolveConfiguredFormConceptInMembers(mappedRequestForm, groupMembers, typeName);
                }
                return inferFormConceptForType(typeName, groupMembers);
            };

            var clearObservationHideFlags = function (groupMembers) {
                walkGroupMembers(groupMembers, function (member) {
                    member.hide = false;
                });
            };

            var applyRequestFormVisibility = function (specimen, targetFormName) {
                var topLevelMembers = getRequestGroupMembers(specimen) || [];
                if (!topLevelMembers.length) {
                    specimen.showAdditionalAttributes = false;
                    return;
                }
                clearObservationHideFlags(topLevelMembers);
                var legacySampleClass = getLegacySampleClassForType(specimen);
                var hasLegacySampleClass = !!legacySampleClass;
                var hasVisibleMember = false;
                _.forEach(topLevelMembers, function (member) {
                    member.hide = false;
                    var memberName = getMemberConceptName(member);
                    var isPathologyTechniqueMember = _.some(pathologyTechniqueConceptNames, function (conceptName) {
                        return normalizeText(memberName) === normalizeText(conceptName);
                    });
                    if ($scope.isPathologyCategory(specimen.orderCategory) && isPathologyTechniqueMember) {
                        member.hide = false;
                    } else if (targetFormName) {
                        member.hide = !isMappedFormConceptMatch(memberName, targetFormName);
                    } else if (hasLegacySampleClass) {
                        var memberClass = getMemberConceptClass(member);
                        member.hide = !(memberClass && normalizeText(legacySampleClass).indexOf(normalizeText(memberClass)) > -1);
                    }
                    if (!member.hide) {
                        hasVisibleMember = true;
                    }
                });
                specimen.showAdditionalAttributes = hasVisibleMember;
            };

            var mergeStyleObjects = function (primaryStyle, secondaryStyle) {
                return angular.extend({}, primaryStyle || {}, secondaryStyle || {});
            };

            $scope.getSpecialOrderButtonStyle = function (isActive) {
                var baseStyle = mergeStyleObjects(defaultSpecialOrderButtonStyles.base, configuredSpecialOrderButtonStyles.base);
                if (!isActive) {
                    return baseStyle;
                }
                return mergeStyleObjects(baseStyle, mergeStyleObjects(defaultSpecialOrderButtonStyles.active, configuredSpecialOrderButtonStyles.active));
            };

            $scope.getTypeSampleButtonStyle = function (isActive) {
                var style = $scope.getSpecialOrderButtonStyle(isActive);
                return mergeStyleObjects(style, {
                    "margin-right": "0",
                    "margin-bottom": "0",
                    "min-width": "0",
                    "width": "100%",
                    "box-sizing": "border-box"
                });
            };

            $scope.isPathologyCategory = function (categoryName) {
                return !!categoryName && categoryName.toLowerCase().indexOf("pathology") > -1;
            };

            var shouldRenderFormForSpecimen = function (specimen) {
                if (!specimen) {
                    return false;
                }
                return true;
            };

            var resolveCategoryFromClass = function (className) {
                if (!className) {
                    return null;
                }
                var normalizedClassName = className.toLowerCase();
                var matchedCategory = _.find($scope.orderCategoryOptions, function (categoryName) {
                    var normalizedCategoryName = (categoryName || "").toLowerCase();
                    return normalizedClassName === normalizedCategoryName ||
                        normalizedClassName.indexOf(normalizedCategoryName) > -1 ||
                        normalizedCategoryName.indexOf(normalizedClassName) > -1;
                });
                return matchedCategory || null;
            };

            var initializeSpecialOrderOptions = function () {
                return $q.all({
                    orderCategory: fetchConceptByName("Order Category"),
                    specialOrderType: fetchConceptByName("Special Order Type"),
                    requestForms: fetchConceptByName("Special Order Request Forms"),
                    pathologyTechnique: fetchConceptByName("Pathology Technique")
                }).then(function (concepts) {
                    var orderCategoryMember = concepts.orderCategory || getConceptSetMemberByName("Order Category");
                    var specialOrderTypeMember = concepts.specialOrderType || getConceptSetMemberByName("Special Order Type");
                    var requestFormsMember = concepts.requestForms || getConceptSetMemberByName("Special Order Request Forms");
                    var pathologyTechniqueMember = concepts.pathologyTechnique || getConceptSetMemberByName("Pathology Technique");
                    var configuredOrderCategories = getAnswerNamesFromMember(orderCategoryMember);
                    $scope.orderCategoryOptions = configuredOrderCategories;
                    orderCategoryConceptMap = {};

                    $scope.orderTypeOptionsByCategory = {};
                    _.each($scope.orderCategoryOptions, function (category) {
                        $scope.orderTypeOptionsByCategory[category] = [];
                    });

                    // Primary source: Order Category answer concepts with configured choices.
                    if (orderCategoryMember && orderCategoryMember.answers) {
                        _.each(orderCategoryMember.answers, function (categoryAnswer) {
                            var categoryName = getConceptDisplayName(categoryAnswer);
                            if (!categoryName) {
                                return;
                            }
                            if (!$scope.orderTypeOptionsByCategory[categoryName]) {
                                $scope.orderTypeOptionsByCategory[categoryName] = [];
                                if (!_.includes($scope.orderCategoryOptions, categoryName)) {
                                    $scope.orderCategoryOptions.push(categoryName);
                                }
                            }
                            orderCategoryConceptMap[normalizeText(categoryName)] = categoryAnswer;

                            var memberTypes = _.chain(categoryAnswer.answers || [])
                                .map(getConceptDisplayName)
                                .filter(function (typeName) {
                                    return !!typeName;
                                })
                                .uniq()
                                .value();
                            _.each(memberTypes, function (typeName) {
                                if (!_.includes($scope.orderTypeOptionsByCategory[categoryName], typeName)) {
                                    $scope.orderTypeOptionsByCategory[categoryName].push(typeName);
                                }
                            });
                        });
                    }

                    // Keep all known type concepts for persisting selected type into specimen.type.
                    var allTypeAnswers = _.chain(orderCategoryConceptMap)
                        .values()
                        .map(function (categoryConcept) { return categoryConcept.answers || []; })
                        .flatten()
                        .uniq(function (answer) { return answer && answer.uuid; })
                        .value();
                    if ((!allTypeAnswers || allTypeAnswers.length === 0) &&
                        specialOrderTypeMember && specialOrderTypeMember.answers) {
                        allTypeAnswers = specialOrderTypeMember.answers;
                    }
                    $scope.specialOrderTypeConcepts = _.map(allTypeAnswers, function (answer) {
                        var mappedConcept = new Bahmni.Common.Domain.ConceptMapper().map(answer);
                        mappedConcept.displayString = getConceptDisplayName(answer) || mappedConcept.name;
                        return mappedConcept;
                    });
                    if (requestFormsMember && requestFormsMember.answers) {
                        $scope.requestFormConcepts = requestFormsMember.answers;
                    }

                    $scope.pathologyTechniqueOptions = getAnswerNamesFromMember(pathologyTechniqueMember);
                });
            };

            $scope.getOrderTypeOptions = function (specimen) {
                return (specimen && specimen.orderCategory && $scope.orderTypeOptionsByCategory[specimen.orderCategory]) || [];
            };

            $scope.onOrderCategoryChange = function (specimen) {
                specimen.orderType = null;
                specimen.pathologyTechnique = null;
                specimen.type = null;
                specimen.typeObservation.type = null;
                var selectedCategoryConcept = getOrderCategoryConceptByName(specimen.orderCategory);
                if (selectedCategoryConcept && selectedCategoryConcept.answers) {
                    $scope.orderTypeOptionsByCategory[specimen.orderCategory] = _.chain(selectedCategoryConcept.answers)
                        .map(getConceptDisplayName)
                        .filter(function (name) { return !!name; })
                        .uniq()
                        .value();
                }
                if (specimen.orderCategory &&
                    (!$scope.orderTypeOptionsByCategory[specimen.orderCategory] ||
                     $scope.orderTypeOptionsByCategory[specimen.orderCategory].length === 0)) {
                    messagingService.showMessage("error", "No sample types found under selected Order Category. Please add answers to that category concept in OpenMRS dictionary.");
                }

                handleSampleTypeOther();
                scheduleFormConditions();
                if ($scope.isUserPrivilegedToEnterResult()) {
                    scheduleReportConditions();
                }
            };

            $scope.selectOrderCategory = function (specimen, category) {
                specimen.orderCategory = category;
                $scope.onOrderCategoryChange(specimen);
            };

            $scope.onOrderTypeChange = function (specimen) {
                var selectedTypeConcept = getTypeConceptByOrderType(specimen.orderType);
                specimen.type = selectedTypeConcept;
                specimen.typeObservation.type = selectedTypeConcept;
                if (!specimen.orderCategory) {
                    specimen.orderCategory = getOrderCategoryByTypeName(specimen.orderType || getSpecimenTypeName(specimen));
                }
                if (!$scope.isPathologyCategory(specimen.orderCategory)) {
                    specimen.pathologyTechnique = null;
                }

                handleSampleTypeOther();
                scheduleFormConditions();
                if ($scope.isUserPrivilegedToEnterResult()) {
                    scheduleReportConditions();
                }
            };

            $scope.selectOrderType = function (specimen, orderType) {
                specimen.orderType = orderType;
                $scope.onOrderTypeChange(specimen);
            };

            $scope.selectPathologyTechnique = function (specimen, technique) {
                specimen.pathologyTechnique = technique;
                // Keep UI-selected technique synchronized with request observation node immediately.
                try {
                    var attributesRoot = specimen &&
                        specimen.sample &&
                        specimen.sample.additionalAttributes &&
                        specimen.sample.additionalAttributes[0];
                    if (attributesRoot && attributesRoot.groupMembers) {
                        walkGroupMembers(attributesRoot.groupMembers, function (member) {
                            if (!member) {
                                return;
                            }
                            var memberConceptName = getObservationConceptName(member);
                            var isNamedTechniqueMember = memberConceptName && _.some(pathologyTechniqueConceptNames, function (conceptName) {
                                return normalizeText(memberConceptName) === normalizeText(conceptName);
                            });
                            var hasTechniqueAnswer = false;
                            if (!isNamedTechniqueMember && member.getPossibleAnswers) {
                                var memberAnswers = member.getPossibleAnswers() || [];
                                hasTechniqueAnswer = _.some(memberAnswers, function (answer) {
                                    var answerName = answer && (answer.displayString || answer.display ||
                                        (answer.name && answer.name.name) || answer.name);
                                    return answerName && normalizeText(answerName) === normalizeText(technique);
                                });
                            }
                            if (!isNamedTechniqueMember && !hasTechniqueAnswer) {
                                return;
                            }
                            if (member.getPossibleAnswers) {
                                var answers = member.getPossibleAnswers() || [];
                                var answerMatch = _.find(answers, function (answer) {
                                    var answerName = answer && (answer.displayString || answer.display ||
                                        (answer.name && answer.name.name) || answer.name);
                                    return answerName && normalizeText(answerName) === normalizeText(technique);
                                });
                                member.value = answerMatch || technique;
                            } else {
                                member.value = technique;
                            }
                        });
                    }
                } catch (e) {
                    console.error("[SpecialOrders][Bacteriology] Unable to sync pathology technique immediately", e && e.message);
                }
                
                scheduleFormConditions();
                if ($scope.isUserPrivilegedToEnterResult()) {
                    scheduleReportConditions();
                }
            };

            $scope.deleteSpecimen = function (specimen) {
                if (specimen.isExistingSpecimen()) {
                    specimen.setMandatoryFieldsBeforeSavingVoidedSpecimen();
                    $scope.deletedSpecimens.push(specimen);
                }
                $scope.savedSpecimens = _.without($scope.savedSpecimens, specimen);
                $scope.newSpecimens = _.without($scope.newSpecimens, specimen);
                if ($scope.newSpecimens.length === 0) {
                    $scope.createNewSpecimen();
                }
            };

            $scope.getDisplayName = function (specimen) {
                var type = specimen.type;
                var displayName = type && (type.shortName ? type.shortName : type.name);
                if (displayName === Bahmni.Clinical.Constants.bacteriologyConstants.otherSampleType) {
                    displayName = specimen.typeFreeText;
                }
                return displayName;
            };

            $scope.getOrderCategoryDisplayName = function (specimen) {
                if (specimen && specimen.orderCategory) {
                    return specimen.orderCategory;
                }
                var typeName = null;
                if (specimen && specimen.type) {
                    typeName = specimen.type.shortName || specimen.type.name;
                    if (typeName && angular.isObject(typeName) && typeName.name) {
                        typeName = typeName.name;
                    }
                }
                return getOrderCategoryByTypeName(typeName);
            };

            $scope.consultation.preSaveHandler.register("bacteriologySaveHandlerKey", saveSpecimens);
            $scope.consultation.postSaveHandler.register("bacteriologyPostSaveHandlerKey", initializeBacteriologyScope);

            var handleSampleTypeOther = function () {
                for (var specimen in $scope.newSpecimens) {
                    var specimenIdentifier = ($scope.newSpecimens[specimen].identifier || "").toString().toLowerCase().trim();
                    if (specimenIdentifier.indexOf("cancelled") === 0 || specimenIdentifier.indexOf("order cancelled") === 0) {
                        $scope.newSpecimens[specimen].cancelled = true;
                        $scope.newSpecimens[specimen].cancellationReason = $scope.newSpecimens[specimen].cancellationReason ||
                            ($scope.newSpecimens[specimen].identifier && $scope.newSpecimens[specimen].identifier.split(":").slice(1).join(":").trim()) ||
                            $scope.newSpecimens[specimen].voidedReason ||
                            null;
                    }
                    $scope.newSpecimens[specimen].cancelled = $scope.newSpecimens[specimen].cancelled ||
                        (($scope.newSpecimens[specimen].identifier || "").toString().toLowerCase().trim().indexOf("cancelled") === 0);
                    if ($scope.newSpecimens[specimen].cancelled) {
                        $scope.newSpecimens[specimen].collectionLabel = 'ORDER CANCELLED';
                        $scope.newSpecimens[specimen].showTypeFreeText = false;
                        continue;
                    }
                    if ($scope.newSpecimens[specimen].type && $scope.newSpecimens[specimen].type.name === Bahmni.Clinical.Constants.bacteriologyConstants.otherSampleType) {
                        $scope.newSpecimens[specimen].showTypeFreeText = true;
                        if ($scope.freeText) {
                            $scope.newSpecimens[specimen].typeFreeText = $scope.freeText;
                        }
                    } else {
                        $scope.newSpecimens[specimen].collectionLabel = $scope.newSpecimens[specimen].identifier ? 'SAMPLE COLLECTED ✔' : 'COLLECT SAMPLE'
                        $scope.newSpecimens[specimen].showTypeFreeText = false;
                        if ($scope.newSpecimens[specimen].type) {
                            $scope.freeText = $scope.newSpecimens[specimen].typeFreeText;
                            $scope.newSpecimens[specimen].typeFreeText = null;
                        }
                    }
                }
            };

            var handleFormConditions = function () {
                for (var specimen in $scope.newSpecimens){
                    var currentSpecimen = $scope.newSpecimens[specimen];
                    var topLevelMembers = getRequestGroupMembers(currentSpecimen) || [];
                    if (!topLevelMembers.length) {
                        currentSpecimen.showAdditionalAttributes = false;
                        continue;
                    }
                    if (!shouldRenderFormForSpecimen(currentSpecimen)) {
                        clearObservationHideFlags(topLevelMembers);
                        _.forEach(topLevelMembers, function (member) {
                            member.hide = true;
                        });
                        currentSpecimen.showAdditionalAttributes = false;
                        continue;
                    }
                    var typeName = getSpecimenTypeName(currentSpecimen) || currentSpecimen.orderType;
                    if (!typeName) {
                        currentSpecimen.showAdditionalAttributes = false;
                        continue;
                    }
                    var targetFormName = getMappedRequestFormConceptForType(currentSpecimen, topLevelMembers);
                    applyRequestFormVisibility(currentSpecimen, targetFormName);
                }
            }

            var handleReportConditions = function () {
                for (var specimen in $scope.newSpecimens) {
                    var currentSpecimen = $scope.newSpecimens[specimen];
                    var groupMembers = getResultGroupMembers(currentSpecimen);
                    if (!groupMembers || !groupMembers.length) {
                        continue;
                    }
                    var typeName = getSpecimenTypeName(currentSpecimen);
                    var legacySampleClass = getLegacySampleClassForType(currentSpecimen);
                    var mappedFormConcept = getMappedResultFormConceptForType(currentSpecimen, groupMembers);
                    if (!shouldRenderFormForSpecimen(currentSpecimen)) {
                        _.forEach(groupMembers, function (member) {
                            member.hide = true;
                        });
                        continue;
                    }
                    if (typeName) {
                        _.forEach(groupMembers, function (member) {
                            member.hide = false;
                            if (mappedFormConcept) {
                                member.hide = !isMappedFormConceptMatch(getMemberConceptName(member), mappedFormConcept);
                                return;
                            }
                            if (legacySampleClass) {
                                var memberClass = getMemberConceptClass(member);
                                member.hide = !(memberClass && normalizeText(legacySampleClass).indexOf(normalizeText(memberClass)) > -1);
                            }
                        });
                    }
                }
            };

            var scheduleFormConditions = function () {
                _.each([0, 300, 800, 1500, 2500], function (delay) {
                    $timeout(handleFormConditions, delay);
                });
            };

            var scheduleReportConditions = function () {
                if (!$scope.isUserPrivilegedToEnterResult()) {
                    return;
                }
                _.each([0, 300, 800, 1500, 2500], function (delay) {
                    $timeout(handleReportConditions, delay);
                });
            };

            $scope.$watch(function () {
                return _.map($scope.newSpecimens || [], function (specimen) {
                    var groupMembers = getRequestGroupMembers(specimen) || [];
                    return [
                        getSpecimenTypeName(specimen),
                        specimen && specimen.orderType,
                        groupMembers.length
                    ].join("|");
                }).join("||");
            }, function () {
                scheduleFormConditions();
            });

            $scope.$watch(function () {
                if (!$scope.isUserPrivilegedToEnterResult()) {
                    return "";
                }
                return _.map($scope.newSpecimens || [], function (specimen) {
                    var groupMembers = getResultGroupMembers(specimen);
                    return [
                        getSpecimenTypeName(specimen),
                        specimen && specimen.orderType,
                        groupMembers ? groupMembers.length : 0
                    ].join("|");
                }).join("||");
            }, function () {
                scheduleReportConditions();
            });

            contextChangeHandler.add(contextChange);

            init();
            _.forEach($scope.newSpecimens, function (specimen) {
                var typeName = getSpecimenTypeName(specimen);
                specimen.orderCategory = specimen.orderCategory || getOrderCategoryByTypeName(typeName);
                specimen.orderType = specimen.orderType || typeName || null;
                specimen.pathologyTechnique = specimen.pathologyTechnique ||
                    getObservationValueByConceptNames(specimen, pathologyTechniqueConceptNames) ||
                    getTechniqueValueFromAnyObservation(specimen) ||
                    null;
            });
        }
    ])
;
