'use strict';

angular.module('bahmni.clinical')
    .controller('O2SessionController', ['$scope', '$interval', '$log', '$rootScope', 'o2SessionService', 'sessionService',
        function ($scope, $interval, $log, $rootScope, o2SessionService, sessionService) {
            var liveTimer = null;

            $scope.o2Session = null;
            $scope.o2SegmentDurations = [];
            $scope.o2TotalLiters = 0;

            var getPatientUuid = function () {
                var scope = $scope;
                while (scope) {
                    if (scope.patient && scope.patient.uuid) {
                        return scope.patient.uuid;
                    }
                    scope = scope.$parent;
                }
                return null;
            };

            var getVisitUuid = function () {
                var scope = $scope;
                while (scope) {
                    if (scope.visitHistory && scope.visitHistory.activeVisit) {
                        return scope.visitHistory.activeVisit.uuid;
                    }
                    scope = scope.$parent;
                }
                return null;
            };

            var getLocationUuid = function () {
                return sessionService.getLoginLocationUuid();
            };

            var formatDuration = function (totalMinutes) {
                var h = Math.floor(totalMinutes / 60);
                var m = totalMinutes % 60;
                return h + 'h ' + m + 'min';
            };

            var updateLiveDurations = function () {
                if (!$scope.o2Session) { return; }
                var now = new Date();
                $scope.o2SegmentDurations = $scope.o2Session.segments.map(function (seg, index) {
                    var endTime = seg.endTime || now;
                    var totalMinutes = Math.floor((endTime - seg.startTime) / 60000);
                    return {
                        index: index,
                        flowRate: seg.flowRate,
                        startTime: seg.startTime,
                        endTime: seg.endTime,
                        totalMinutes: totalMinutes,
                        display: formatDuration(totalMinutes),
                        isOpen: seg.endTime === null
                    };
                });
                $scope.o2TotalLiters = parseFloat(
                    $scope.o2Session.calculateConsumption($scope.o2Session.startTime, now).toFixed(2)
                );
            };

            var applySessionFromModel = function (sessionModel) {
                $scope.o2Session = sessionModel;
                if (!sessionModel) {
                    stopLiveTimer();
                    $scope.o2SegmentDurations = [];
                    $scope.o2TotalLiters = 0;
                    return;
                }
                if (sessionModel.status === Bahmni.Clinical.O2Session.STATUS.ACTIVE) {
                    startLiveTimer();
                } else {
                    stopLiveTimer();
                    updateLiveDurations();
                }
            };

            var startLiveTimer = function () {
                if (liveTimer) { return; }
                updateLiveDurations();
                liveTimer = $interval(updateLiveDurations, 60000);
            };

            var stopLiveTimer = function () {
                if (liveTimer) {
                    $interval.cancel(liveTimer);
                    liveTimer = null;
                }
            };

            var loadSessionForDisplay = function () {
                var patientUuid = getPatientUuid();
                var visitUuid = getVisitUuid();

                if (!patientUuid || !visitUuid) {
                    return;
                }

                o2SessionService.getSegments(patientUuid, visitUuid)
                    .then(function (segments) {
                        if (segments.length === 0) {
                            applySessionFromModel(null);
                            return;
                        }

                        var wardUuid = getLocationUuid();
                        var sessionModel = Bahmni.Clinical.O2Session.fromSavedGroups(
                            patientUuid, wardUuid, segments, null
                        );

                        segments.forEach(function (seg) {
                            if (!seg.endTime || !seg.encounterUuid || !seg.obsGroupUuid) { return; }
                            var totalMinutes = (seg.endTime - seg.startTime) / 60000;
                            o2SessionService.saveTotalHour(
                                seg.encounterUuid,
                                seg.obsGroupUuid,
                                seg.totalHourObsUuid,
                                totalMinutes
                            ).catch(function (err) {
                                $log.error('[O2Session] saveTotalHour failed for segment', seg.obsGroupUuid, err);
                            });
                        });

                        applySessionFromModel(sessionModel);
                    })
                    .catch(function (err) {
                        $log.error('[O2Session] Error fetching segments', err);
                    });
            };

            /** After consultation Save: ConsultationController + o2SessionService broadcasts here. */
            var deregisterO2SyncListener = $rootScope.$on('o2-session:updated', function (event, payload) {
                if (!payload || !payload.o2Session) {
                    applySessionFromModel(null);
                    return;
                }
                applySessionFromModel(payload.o2Session);
            });

            var init = function () {
                var unwatchVisit = $scope.$watch(function () {
                    return getVisitUuid();
                }, function (visitUuid) {
                    if (visitUuid) {
                        loadSessionForDisplay();
                        unwatchVisit();
                    }
                });
            };

            init();

            $scope.$on('$destroy', function () {
                stopLiveTimer();
                deregisterO2SyncListener();
            });
        }
    ]);
