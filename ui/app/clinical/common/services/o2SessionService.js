'use strict';

angular.module('bahmni.clinical')
    .factory('o2SessionService', ['$http', '$log', '$rootScope', '$bahmniCookieStore',
        function ($http, $log, $rootScope, $bahmniCookieStore) {
            var CONCEPTS = Bahmni.Clinical.Constants.o2Concepts;
            var ENCOUNTER_URL = Bahmni.Common.Constants.bahmniEncounterUrl;
            var REST_OBS_URL = '/openmrs/ws/rest/v1/obs';

            var TRIGGER_PERIODIC = 1;
            var TRIGGER_DISCONTINUATION = 2;

            /** Event for O2SessionController widget (optional). */
            var O2_SYNC_EVENT = 'o2-session:updated';

            // ── Resolve the current provider UUID ─────────────────────────────
            var getProviderUuid = function () {
                var providerData = $bahmniCookieStore.get(
                    Bahmni.Common.Constants.grantProviderAccessDataCookieName
                );
                if (providerData && providerData.uuid) {
                    return providerData.uuid;
                }
                if ($rootScope.currentProvider && $rootScope.currentProvider.uuid) {
                    return $rootScope.currentProvider.uuid;
                }
                return null;
            };

            // ── Fetch all saved O2 form groups for a patient visit ────────────
            // The form saves all flow rate changes as members of a SINGLE obs group.
            // Each escalation/de-escalation adds a new Flow Rate + Start Time pair
            // to that group, identified by matching obs_datetime values.
            var isTruthyObsValue = function (value) {
                return value === true || value === 'true' || value === 'Yes' || value === 'YES' || value === 1 || value === '1';
            };

            var getSegments = function (patientUuid, visitUuid) {
                $log.info('[O2SessionService] Fetching segments', { patientUuid: patientUuid, visitUuid: visitUuid });

                return $http.get(Bahmni.Common.Constants.observationsUrl, {
                    params: {
                        patientUuid: patientUuid,
                        visitUuid: visitUuid,
                        concept: 'St. Peter Oxygen Consumption Registration Form'
                    },
                    withCredentials: true
                }).then(function (response) {
                    var rawObs = response.data || [];
                    $log.info('[O2SessionService] Raw observation groups received:', rawObs.length);

                    var segments = [];
                    var discontinuationTime = null;

                    rawObs.forEach(function (obsGroup) {
                        var members = obsGroup.groupMembers || [];

                        // Collect all flow rate observations and all start time observations.
                        // Each escalation adds one of each, paired by their obsDatetime.
                        var flowRateObs = _.filter(members, function (m) {
                            return m.concept && m.concept.uuid === CONCEPTS.flowRate;
                        });
                        var startTimeObs = _.filter(members, function (m) {
                            return m.concept && m.concept.uuid === CONCEPTS.startTime;
                        });
                        var endTimeObs = _.filter(members, function (m) {
                            return m.concept && m.concept.uuid === CONCEPTS.endTime;
                        });
                        var patientOffObs = _.find(members, function (m) {
                            return m.concept && m.concept.uuid === CONCEPTS.patientOffO2;
                        });
                        var totalHourObs = _.find(members, function (m) {
                            return m.concept && m.concept.uuid === CONCEPTS.totalHour;
                        });
                        var patientOffO2 = patientOffObs ? isTruthyObsValue(patientOffObs.value) : false;

                        if (flowRateObs.length === 0 || startTimeObs.length === 0) {
                            if (patientOffO2) {
                                var stopObs = endTimeObs[0] || patientOffObs || obsGroup;
                                var rawStopTime = stopObs.value || stopObs.obsDatetime || stopObs.observationDateTime;
                                discontinuationTime = rawStopTime ? new Date(rawStopTime) : new Date();
                                $log.info('[O2SessionService] Found O2 discontinuation-only group', {
                                    obsGroupUuid: obsGroup.uuid,
                                    discontinuationTime: discontinuationTime
                                });
                                return;
                            }
                            $log.info('[O2SessionService] Skipping group with no flow rate or start time', obsGroup.uuid);
                            return;
                        }

                        // Sort both arrays by obsDatetime so they pair up correctly
                        var byTime = function (a, b) {
                            return new Date(a.obsDatetime || a.observationDateTime) -
                                   new Date(b.obsDatetime || b.observationDateTime);
                        };
                        flowRateObs.sort(byTime);
                        startTimeObs.sort(byTime);
                        endTimeObs.sort(byTime);

                        // Build one segment per flow rate entry
                        flowRateObs.forEach(function (frObs, i) {
                            var stObs = startTimeObs[i];
                            if (!stObs) { return; }

                            var etObs = endTimeObs[i] || null;
                            segments.push({
                                obsGroupUuid: obsGroup.uuid,
                                encounterUuid: obsGroup.encounterUuid,
                                flowRate: parseFloat(frObs.value),
                                startTime: new Date(stObs.value),
                                endTime: etObs && etObs.value ? new Date(etObs.value) : null,
                                patientOffO2: patientOffO2,
                                totalHourObsUuid: totalHourObs ? totalHourObs.uuid : null
                            });
                        });
                    });

                    segments.sort(function (a, b) { return a.startTime - b.startTime; });
                    if (discontinuationTime && segments.length > 0) {
                        var lastSegment = segments[segments.length - 1];
                        lastSegment.patientOffO2 = true;
                        lastSegment.endTime = lastSegment.endTime || discontinuationTime;
                    }
                    $log.info('[O2SessionService] Segments parsed and sorted:', segments.length);
                    return segments;
                });
            };

            // ── Fetch timestamp for the last successful Odoo billing push ─────
            // Stored as a standalone obs under the oxygen encounter.
            var getLastPushTimestamp = function (encounterUuid) {
                var conceptUuid = CONCEPTS.lastOdooPushTimestamp;
                if (!encounterUuid || !conceptUuid) { return Promise.resolve(null); }
                return $http.get(Bahmni.Common.Constants.observationsUrl, {
                    params: {
                        encounterUuid: encounterUuid,
                        concept: conceptUuid,
                        scope: 'latest',
                        numberOfVisits: 1
                    },
                    withCredentials: true
                }).then(function (response) {
                    var results = response.data || [];
                    if (results.length === 0) { return null; }
                    var timeMs = function (obs) {
                        var raw = obs.observationDateTime || obs.obsDatetime;
                        if (!raw) { return 0; }
                        var t = new Date(raw).getTime();
                        return isNaN(t) ? 0 : t;
                    };
                    results.sort(function (a, b) {
                        return timeMs(b) - timeMs(a);
                    });
                    var rawDatetime = results[0].observationDateTime || results[0].obsDatetime;
                    if (!rawDatetime) { return null; }
                    var latest = new Date(rawDatetime);
                    if (isNaN(latest.getTime())) { return null; }
                    $log.info('[O2SessionService] Last Odoo push timestamp:', latest);
                    return latest;
                }).catch(function () {
                    return null;
                });
            };

            var pad2 = function (n) {
                return (n < 10 ? '0' : '') + n;
            };

            // Obs value (Datetime concept): legacy parser expects "yyyy-MM-dd HH:mm:ss"
            var formatOpenMrsObsValue = function (date) {
                var d = date || new Date();
                return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
                    pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
            };

            // Obs metadata field: OpenMRS REST expects "yyyy-MM-dd'T'HH:mm:ss.SSS+0000"
            var formatOpenMrsObsDatetime = function (date) {
                return (date || new Date()).toISOString().replace('Z', '+0000');
            };

            var saveLastPushTimestamp = function (encounterUuid, patientUuid, timestamp) {
                var conceptUuid = CONCEPTS.lastOdooPushTimestamp;
                if (!encounterUuid || !patientUuid || !conceptUuid) { return Promise.resolve(); }
                var when = timestamp || new Date();
                return $http.post(REST_OBS_URL, {
                    concept: conceptUuid,
                    value: formatOpenMrsObsValue(when),
                    obsDatetime: formatOpenMrsObsDatetime(when),
                    encounter: encounterUuid,
                    person: patientUuid
                }, { withCredentials: true });
            };

            // ── Write Total Hour on Oxygen back into a saved obs group ────────

            var saveTotalHour = function (encounterUuid, obsGroupUuid, totalHourObsUuid, totalMinutes) {
                var decimalHours = parseFloat((totalMinutes / 60).toFixed(4));
                $log.info('[O2SessionService] Saving Total Hour on Oxygen', {
                    encounterUuid: encounterUuid,
                    obsGroupUuid: obsGroupUuid,
                    totalMinutes: totalMinutes,
                    decimalHours: decimalHours
                });

                var memberPayload = {
                    concept: { uuid: CONCEPTS.totalHour, name: 'Total Hour on Oxygen', dataType: 'Numeric' },
                    value: decimalHours,
                    obsDatetime: new Date().toISOString()
                };
                if (totalHourObsUuid) {
                    memberPayload.uuid = totalHourObsUuid;
                }

                return $http.post(ENCOUNTER_URL, {
                    encounterUuid: encounterUuid,
                    observations: [{
                        uuid: obsGroupUuid,
                        concept: {
                            uuid: CONCEPTS.formConceptUuid,
                            name: 'St. Peter Oxygen Consumption Registration Form',
                            dataType: 'N/A'
                        },
                        groupMembers: [memberPayload]
                    }]
                }, { withCredentials: true }).then(function (response) {
                    $log.info('[O2SessionService] Total Hour saved successfully');
                    return response.data;
                });
            };

            // ── Save a billing encounter with an O2 Order ─────────────────────
            // Uses the Bahmni encounter API (/bahmnicore/bahmniencounter) which
            // correctly saves orders to OpenMRS so the atomfeed can read them.
            // The order structure mirrors how lab/radiology orders are saved.
            // triggerType: 'PERIODIC' or 'DISCONTINUATION'

            var saveBillingEncounter = function (patientUuid, locationUuid, totalLiters, durationMinutes, triggerType) {
                var triggerCode = triggerType === 'DISCONTINUATION' ? TRIGGER_DISCONTINUATION : TRIGGER_PERIODIC;
                var providerUuid = getProviderUuid();
                var O2 = Bahmni.Clinical.Constants;

                var payload = {
                    patientUuid: patientUuid,
                    encounterTypeUuid: O2.consultationEncounterTypeUuid,
                    locationUuid: locationUuid,
                    drugOrders: [],
                    observations: [{
                        concept: {
                            uuid: CONCEPTS.formConceptUuid,
                            name: 'St. Peter Oxygen Consumption Registration Form',
                            dataType: 'N/A'
                        },
                        groupMembers: [
                            {
                                concept: { uuid: CONCEPTS.billingTotalLiters, name: 'O2 Total Liters Consumed', dataType: 'Numeric' },
                                value: parseFloat(totalLiters.toFixed(4))
                            },
                            {
                                concept: { uuid: CONCEPTS.billingDurationMinutes, name: 'O2 Billing Duration (Minutes)', dataType: 'Numeric' },
                                value: parseFloat(durationMinutes.toFixed(2))
                            },
                            {
                                concept: { uuid: CONCEPTS.billingTrigger, name: 'O2 Billing Trigger', dataType: 'Numeric' },
                                value: triggerCode
                            }
                        ]
                    }],
                    extensions: {},
                    orders: [{
                        concept: {
                            uuid: O2.o2OrderConceptUuid,
                            name: 'Oxygen Therapy'
                        },
                        orderTypeUuid: O2.o2OrderTypeUuid,
                        orderer: providerUuid,
                        type: 'order',
                        action: 'NEW',
                        // commentToFulfiller: parseFloat(totalLiters.toFixed(4)) + ' L | ' + triggerType,
                        commentToFulfiller: JSON.stringify({oxygenTotal: parseFloat(totalLiters.toFixed(4)), trigger: triggerType}),
                        urgency: 'ROUTINE'
                    }]
                };

                if (providerUuid) {
                    payload.providers = [{ uuid: providerUuid }];
                }

                $log.info('[O2SessionService] Saving billing encounter with O2 Order', payload);
                console.warn('[O2 DEBUG] patientUuid being sent:', patientUuid, '| ENCOUNTER_URL:', ENCOUNTER_URL);

                return $http.post(ENCOUNTER_URL, payload, { withCredentials: true })
                    .then(function (response) {
                        $log.info('[O2SessionService] Billing encounter saved — atomfeed will pick this up');
                        return response.data;
                    });
            };

            // ── Billing gating & post-save sync (consultation-wide, not scoped to observations tab)

            /**
             * Fire a single billing event covering the window [fromTime, toTime].
             * toTime defaults to now when not supplied (used for DISCONTINUATION).
             * Duration is rounded UP to the nearest minute so partial minutes are
             * always billed in favour of the hospital.
             */
            var pushBillingEvent = function (sessionModel, locationUuid, triggerType, fromTime, patientUuid, toTime) {
                if (!sessionModel || !patientUuid) { return; }

                var billingTo = toTime || new Date();
                var liters = sessionModel.calculateConsumption(fromTime, billingTo);
                // Round up to the nearest whole minute
                var durationMinutes = Math.ceil((billingTo - fromTime) / 60000);

                $log.info('[O2SessionService] === BILLING PUSH ===', {
                    trigger: triggerType,
                    fromTime: fromTime,
                    toTime: billingTo,
                    totalLiters: liters.toFixed(4),
                    durationMinutes: durationMinutes
                });

                if (durationMinutes <= 0 || liters <= 0) {
                    $log.info('[O2SessionService] No billable usage in current window, skipping push');
                    return Promise.resolve(false);
                }

                return saveBillingEncounter(
                    patientUuid,
                    locationUuid,
                    liters,
                    durationMinutes,
                    triggerType
                ).then(function () {
                    $log.info('[O2SessionService] Billing encounter saved successfully');
                    return true;
                }).catch(function (err) {
                    $log.error('[O2SessionService] Failed to save billing encounter', err);
                    return false;
                });
            };
            var checkAndFireBilling = function (sessionModel, patientUuid, locationUuid, encounterUuid, shouldRunO2Billing) {
                if (!shouldRunO2Billing) {
                    $log.info('[O2SessionService] Save is not from oxygen form — billing skipped');
                    return;
                }
                if (!patientUuid || !sessionModel || !encounterUuid) { return; }

                if (!CONCEPTS.lastOdooPushTimestamp) {
                    $log.warn('[O2SessionService] lastOdooPushTimestamp UUID is missing — billing skipped');
                    return;
                }

                var billingWindowMs = Bahmni.Clinical.Constants.o2BillingWindowMinutes * 60 * 1000;
                var now = new Date();

                getLastPushTimestamp(encounterUuid).then(function (lastPushTimestamp) {
                    var fromTime = lastPushTimestamp || sessionModel.startTime;
                    if (!fromTime || now <= fromTime) {
                        $log.info('[O2SessionService] No billable window found');
                        return;
                    }

                    if (sessionModel.status === Bahmni.Clinical.O2Session.STATUS.DISCONTINUED) {
                        $log.info('[O2SessionService] Trigger B — DISCONTINUATION billing');
                        return pushBillingEvent(sessionModel, locationUuid, 'DISCONTINUATION', fromTime, patientUuid, now)
                            .then(function (pushed) {
                                if (pushed) {
                                    return saveLastPushTimestamp(encounterUuid, patientUuid, now);
                                }
                            });
                    }

                    if ((now - fromTime) >= billingWindowMs) {
                        $log.info('[O2SessionService] Trigger A — PERIODIC billing');
                        return pushBillingEvent(sessionModel, locationUuid, 'PERIODIC', fromTime, patientUuid, now)
                            .then(function (pushed) {
                                if (pushed) {
                                    return saveLastPushTimestamp(encounterUuid, patientUuid, now);
                                }
                            });
                    }

                    $log.info('[O2SessionService] Billing window not yet reached — no billing this save');
                });
            };

            /**
             * Runs after ConsultationController save(): persist total-hours, rebuild session snapshot,
             * notify O2 widget, run billing gates. Lives on stable consultation scope — not observations tab only.
             */
            var runAfterConsultationEncounterSaved = function (patientUuid, visitUuid, locationUuid, encounterUuid, shouldRunO2Billing) {
                if (!shouldRunO2Billing) {
                    $log.info('[O2SessionService] Save is not from oxygen form — O2 calculation/billing skipped');
                    return Promise.resolve(null);
                }

                return getSegments(patientUuid, visitUuid)
                    .then(function (segments) {
                        if (segments.length === 0) {
                            $rootScope.$broadcast(O2_SYNC_EVENT, {});
                            return null;
                        }

                        segments.forEach(function (seg) {
                            if (!seg.endTime || !seg.encounterUuid || !seg.obsGroupUuid) { return; }
                            var totalMinutes = (seg.endTime - seg.startTime) / 60000;
                            saveTotalHour(
                                seg.encounterUuid,
                                seg.obsGroupUuid,
                                seg.totalHourObsUuid,
                                totalMinutes
                            ).catch(function (err) {
                                $log.error('[O2SessionService] saveTotalHour failed for segment', seg.obsGroupUuid, err);
                            });
                        });

                        var sessionModel = Bahmni.Clinical.O2Session.fromSavedGroups(
                            patientUuid, locationUuid, segments, null
                        );
                        $rootScope.$broadcast(O2_SYNC_EVENT, { o2Session: sessionModel });

                        checkAndFireBilling(sessionModel, patientUuid, locationUuid, encounterUuid, shouldRunO2Billing);
                        return sessionModel;
                    })
                    .catch(function (err) {
                        $log.error('[O2SessionService] runAfterConsultationEncounterSaved failed', err);
                        return null;
                    });
            };

            return {
                getSegments: getSegments,
                getLastPushTimestamp: getLastPushTimestamp,
                saveTotalHour: saveTotalHour,
                saveBillingEncounter: saveBillingEncounter,
                saveLastPushTimestamp: saveLastPushTimestamp,
                runAfterConsultationEncounterSaved: runAfterConsultationEncounterSaved
            };
        }]);
