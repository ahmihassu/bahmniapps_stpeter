'use strict';

angular.module('bahmni.clinical')
    .controller('AppointmentsCreateController', ['$scope', '$rootScope', '$q', '$window', '$state', '$translate', 'spinner', 'patientService', '$timeout',
        'appointmentsService', 'appointmentsServiceService', 'messagingService', 'appointmentCommonService',
        'ngDialog', 'appService', '$stateParams', 'appointmentCreateConfig', 'appointmentContext', '$http', 'sessionService', 'diagnosisService', 'holidayConfig',
        function ($scope, $rootScope, $q, $window, $state, $translate, spinner, patientService, $timeout, appointmentsService, appointmentsServiceService,
            messagingService, appointmentCommonService, ngDialog, appService, $stateParams, appointmentCreateConfig, appointmentContext, $http, sessionService, diagnosisService, holidayConfig) {
            $scope.isFilterOpen = $stateParams.isFilterOpen;
            $scope.showConfirmationPopUp = true;
            $scope.enableSpecialities = appService.getAppDescriptor().getConfigValue('enableSpecialities');
            $scope.enableServiceTypes = appService.getAppDescriptor().getConfigValue('enableServiceTypes');
            $scope.today = Bahmni.Common.Util.DateUtil.getDateWithoutTime(Bahmni.Common.Util.DateUtil.now());
            $scope.timeRegex = Bahmni.Clinical.Constants.regexForTime;
            $scope.warning = {};
            $scope.minDuration = Bahmni.Clinical.Constants.minDurationForAppointment;

            function parseHolidays(csv) {
                const lines = csv.trim().split('\n').slice(1); // Remove header
                return lines.map(line => {
                    const parts = line.split(',');
                    return parts[1].trim(); // Get the date
                });
            }


            $scope.holidays = parseHolidays(holidayConfig)


            var providerListForCurrentUser = function (providers) {
                if (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Clinical.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges)) {
                    return providers;
                }
                if (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Clinical.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges)) {
                    return _.filter(providers, function (provider) {
                        return provider.uuid === $rootScope.currentProvider.uuid;
                    });
                }
                return providers;
            };

            $scope.appointmentCreateConfig = appointmentCreateConfig;
            $scope.appointmentCreateConfig.providers = providerListForCurrentUser(appointmentCreateConfig.providers);
            $scope.enableEditService = appService.getAppDescriptor().getConfigValue('isServiceOnAppointmentEditable');
            $scope.showStartTimes = [];
            $scope.showEndTimes = [];
            var patientSearchURL = appService.getAppDescriptor().getConfigValue('patientSearchUrl');
            var loginLocationUuid = sessionService.getLoginLocationUuid();
            $scope.minCharLengthToTriggerPatientSearch = appService.getAppDescriptor().getConfigValue('minCharLengthToTriggerPatientSearch') || 3;

            $scope.maxAppointmentProviders = appService.getAppDescriptor().getConfigValue("maxAppointmentProviders") || 1;

            var isProviderNotAvailableForAppointments = function (selectedProvider) {
                var providers = appointmentCreateConfig.providers;
                return _.isUndefined(_.find(providers, function (provider) {
                    return selectedProvider.uuid === provider.uuid;
                }));
            };
            var init = function () {
                wireAutocompleteEvents();
                if (!_.isEmpty(appointmentContext) && !_.isEmpty(appointmentContext.appointment) && !_.isEmpty(appointmentContext.appointment.provider)) {
                    var isProviderNotAvailable = isProviderNotAvailableForAppointments(appointmentContext.appointment.provider);
                    if (isProviderNotAvailable) {
                        appointmentContext.appointment.provider.person = { display: appointmentContext.appointment.provider.name };
                        appointmentCreateConfig.providers.push(appointmentContext.appointment.provider);
                    }
                }
                $scope.appointment = Bahmni.Clinical.AppointmentViewModel.create(appointmentContext.appointment || { appointmentKind: 'Scheduled' }, appointmentCreateConfig);
                $scope.appointment.newProvider = null;
                $scope.selectedService = appointmentCreateConfig.selectedService;
                $scope.isPastAppointment = $scope.isEditMode() ? Bahmni.Common.Util.DateUtil.isBeforeDate($scope.appointment.date, moment().startOf('day')) : false;

                $scope.search().then(function (response) {
                    var result = $scope.responseMap(response);
                    $scope.appointment.patient = result;
                    if ($scope.appointment.patient) {
                        $scope.onSelectPatient($scope.appointment.patient);
                    }
                })

                $scope.addNewProvider($rootScope.currentUser);


            };

            $scope.allowProviderAddition = function () {
                if ($scope.appointment.providers != undefined) {
                    return $scope.appointment.providers.filter(function (p) {
                        return p.response !== Bahmni.Clinical.Constants.providerResponses.CANCELLED;
                    }).length < $scope.maxAppointmentProviders;
                } else {
                    return $scope.maxAppointmentProviders > 0;
                }
            };

            $scope.addNewProvider = function (newProvider) {
                if ($scope.appointment.providers == undefined) {
                    $scope.appointment.providers = [];
                }

                // Assuming 'newProvider' is passed directly (you can replace this with the relevant provider data)
                if ($scope.allowProviderAddition() && newProvider) {
                    // Check if the provider is already added
                    var pList = $scope.appointment.providers.filter(function (provider) {
                        return provider.uuid === newProvider.uuid;
                    });

                    // If provider is not already present, add it
                    if (pList.length === 0) {
                        var p = {
                            uuid: $rootScope.currentProvider.uuid,
                            response: Bahmni.Clinical.Constants.providerResponses.ACCEPTED,
                            name: newProvider.person.personName.givenName + " " + newProvider.person.personName.familyName || newProvider.person.display,
                            comments: null
                        };
                        $scope.appointment.providers.push(p);
                    } else if (pList.length === 1) {
                        // If provider exists, update its response
                        pList[0].response = Bahmni.Clinical.Constants.providerResponses.ACCEPTED;
                    }
                }

                // Clear the new provider selection
                $scope.appointment.newProvider = null;
            };


            $scope.removeProviderFromAttendees = function (appProvider) {
                var index = $scope.appointment.providers.indexOf(appProvider);
                if (index > -1) {
                    $scope.appointment.providers.splice(index, 1);
                }
            };

            $scope.save = function () {
                var message;

                if ($scope.createAppointmentForm.$invalid) {
                    message = $scope.createAppointmentForm.$error.pattern
                        ? 'INVALID_TIME_ERROR_MESSAGE' : 'INVALID_SERVICE_FORM_ERROR_MESSAGE';
                }
                if (message) {
                    messagingService.showMessage('error', message);
                    return;
                }

                $scope.validatedAppointment = Bahmni.Clinical.Appointment.create($scope.appointment);
                var conflictingAppointments = getConflictingAppointments($scope.validatedAppointment);
                if (conflictingAppointments.length === 0) {
                    return saveAppointment($scope.validatedAppointment);
                } else {
                    $scope.displayConflictConfirmationDialog();
                }
            };


            $scope.search = function () {
                var formattedUrl;
                var isIdentifier = true
                if (patientSearchURL && !_.isEmpty(patientSearchURL)) {
                    var params = {
                        q: patientSearchURL,
                        v: "full",
                        identifier: $scope.$parent?.$parent?.patient?.identifier
                    };
                    formattedUrl = appService.getAppDescriptor().formatUrl(patientSearchURL, params);
                }
                return (spinner.forPromise(formattedUrl ? (patientService.findPatients(params).then(function (response) { return response.data })) :
                    isIdentifier ? patientService.bahmniSearchById($scope.$parent?.$parent?.patient?.identifier) : patientService.search($scope.$parent?.$parent?.patient?.identifier)).
                    then(function (response) {
                        if (response.data == undefined) {
                            return response[0];
                        } else {
                            return response.data.pageOfResults[0];
                        }
                    }));
            };

            var isNewAppointmentConflictingWithExistingAppointmentForFilter = function (existingAppointment, newAppointment) {
                var existingStart = moment(existingAppointment.startDateTime),
                    existingEnd = moment(existingAppointment.endDateTime);
                var newStart = moment(newAppointment.startDateTime),
                    newEnd = moment(newAppointment.startDateTime + existingAppointment.endDateTime - existingAppointment.startDateTime);
                return !(newAppointmentStartingEndingBeforeExistingAppointment(existingStart, newStart, newEnd) ||
                    newAppointmentStartingEndingAfterExistingAppointment(newStart, existingStart, existingEnd));
            };
            var checkForConflictInFilter = function (existingAppointment, newAppointment) {

                var isOnSameDay = moment(existingAppointment.startDateTime).diff(moment(newAppointment.startDateTime), 'days') === 0;
                var isAppointmentTimingConflicted = isNewAppointmentConflictingWithExistingAppointmentForFilter(existingAppointment, newAppointment);
                var isSimilarLocation = existingAppointment?.location?.uuid == newAppointment.locationUuid  //አንዳንድ ጊዜ ቦታ አይሞላም፣ እና ባዶ ይሆናል እና ይህ ያልተገለጸ uuid እንዲኖረው ያደርገዋል
                var isSimilarService = existingAppointment.service.uuid == newAppointment.serviceUuid;
                return existingAppointment.uuid !== newAppointment.uuid &&
                    existingAppointment.status !== 'Cancelled' &&
                    isOnSameDay && isAppointmentTimingConflicted && isSimilarLocation && isSimilarService;
            };
            var getConflictingAppointmentsForFilter = function (appointment) {
                return _.filter($scope.patientAppointments, function (bookedAppointment) {
                    return checkForConflictInFilter(bookedAppointment, appointment);
                });
            };
            // $scope.timeSource = function () {
            //     return $q(function (resolve) {
            //         let availableTimes = $scope.showStartTimes;

            //         let formattedDate = moment($scope.appointment.date).format("YYYY-MM-DD");
            //         let filteredTimes = availableTimes.filter(time => {
            //             let parsedTime = moment(time, ["h:mm A", "hh:mm A"]).format("hh:mm A");
            //             let startDateTime = moment(formattedDate + " " + parsedTime, "YYYY-MM-DD hh:mm A", true);
            //             let tempAppointment = {
            //                 startDateTime: startDateTime.valueOf(),
            //                 locationUuid: $scope.appointment.location.uuid,
            //                 serviceUuid: $scope.appointment.service.uuid,
            //                 uuid: $scope.appointment.uuid
            //             };
            //             let conflicts = getConflictingAppointmentsForFilter(tempAppointment);
            //             return conflicts.length === 0;
            //         });
            //         resolve(filteredTimes);
            //     });
            // };

            $scope.endTimeSlots = function () {
                return $q(function (resolve) {
                    resolve($scope.showEndTimes);
                });
            };

            $scope.onSelectPatient = function (data) {
                $scope.appointment.patient = data;
                getPhoneNumber(data.personId).then(function (response) {
                    if (response.data[0] != undefined)
                        $scope.appointment.pno = parseInt(response.data[0].value)
                })
                getLastVisitUuid(data.personId).then(function (response) {
                    var visitUuid = response.data[0].uuid;
                    return visitUuid;
                }).then(function (visitUuid) {
                    diagnosisService.getDiagnoses($scope.appointment.patient.uuid, visitUuid)
                        .then(function (response) {
                            var diagnoses = response.data
                            $scope.diagnoses = diagnoses.map(function (diagnosis) {
                                return diagnosis.codedAnswer.name;
                            });
                        })
                })
                /* return spinner.forPromise(appointmentsService.search({patientUuid: data.uuid}).then(function (oldAppointments) {
                     $scope.patientAppointments = oldAppointments.data;
                 })); */
            };

            var getLastVisitUuid = function (personId) {
                var params = {
                    q: "get_last_visit",
                    person_id: personId
                };
                return $http.get(Bahmni.Common.Constants.sqlUrl, {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            }
            var getPhoneNumber = function (personId) {
                var params = {
                    q: "get_patient_phone",
                    person_id: personId
                };
                return $http.get(Bahmni.Common.Constants.sqlUrl, {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            }

            var clearSlotsInfo = function () {
                delete $scope.currentLoad;
                delete $scope.maxAppointmentsLimit;
            };

            var getSlotsInfo = function () {
                var daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                var selectedService = $scope.selectedService;
                var appointment = $scope.appointment;
                var startDateTime, endDateTime;
                var availabilityObject;
                clearSlotsInfo();
                if (!_.isEmpty(selectedService.weeklyAvailability)) {
                    var availability = _.find(selectedService.weeklyAvailability, function (avb) {
                        return daysOfWeek[appointment.date.getDay()] === avb.dayOfWeek &&
                            moment(avb.startTime, 'hh:mm a') <= moment(appointment.startTime, 'hh:mm a') &&
                            moment(appointment.endTime, 'hh:mm a') <= moment(avb.endTime, 'hh:mm a');
                    });
                    if (availability) {
                        availabilityObject = availability;
                        availabilityObject.durationMins = selectedService.durationMins || $scope.minDuration;
                    }
                } else {
                    if (moment(selectedService.startTime || "00:00", 'hh:mm a') <= moment(appointment.startTime, 'hh:mm a') &&
                        moment(appointment.endTime, 'hh:mm a') <= moment(selectedService.endTime || "23:59", 'hh:mm a')) {
                        availabilityObject = selectedService;
                    }
                }
                if (availabilityObject) {
                    $scope.maxAppointmentsLimit = availabilityObject.maxAppointmentsLimit || calculateMaxLoadFromDuration(availabilityObject);
                    startDateTime = getDateTime(appointment.date, availabilityObject.startTime || "00:00");
                    endDateTime = getDateTime(appointment.date, availabilityObject.endTime || "23:59");
                    appointmentsServiceService.getServiceLoad(selectedService.uuid, startDateTime, endDateTime).then(function (response) {
                        $scope.currentLoad = response.data;
                    });
                }
            };

            var dateUtil = Bahmni.Common.Util.DateUtil;
            var calculateMaxLoadFromDuration = function (avb) {
                if (avb.durationMins && avb.startTime && avb.endTime) {
                    var startTime = moment(avb.startTime, ["hh:mm a"]);
                    var endTime = moment(avb.endTime, ["hh:mm a"]);
                    return Math.round((dateUtil.diffInMinutes(startTime, endTime)) / avb.durationMins);
                }
            };

            var getDateTime = function (date, time) {
                var formattedTime = moment(time, ["hh:mm a"]).format("HH:mm");
                return dateUtil.parseServerDateToDate(dateUtil.getDateWithoutTime(date) + ' ' + formattedTime);
            };

            var isAppointmentTimeWithinServiceAvailability = function (appointmentTime) {
                if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length) {
                    return _.find($scope.weeklyAvailabilityOnSelectedDate, function (availability) {
                        return !(moment(appointmentTime, 'hh:mm a').isBefore(moment(availability.startTime, 'hh:mm a')) ||
                            moment(availability.endTime, 'hh:mm a').isBefore(moment(appointmentTime, 'hh:mm a')));
                    });
                } else if ($scope.allowedStartTime || $scope.allowedEndTime) {
                    return !(moment(appointmentTime, 'hh:mm a').isBefore(moment($scope.allowedStartTime, 'hh:mm a')) ||
                        moment($scope.allowedEndTime, 'hh:mm a').isBefore(moment(appointmentTime, 'hh:mm a')));
                }
                return true;
            };

            var isAppointmentStartTimeAndEndTimeWithinServiceAvailability = function () {
                var appointmentStartTime = $scope.appointment.startTime;
                var appointmentEndTime = $scope.appointment.endTime;

                if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length) {
                    return _.find($scope.weeklyAvailabilityOnSelectedDate, function (availability) {
                        return (moment(availability.startTime, 'hh:mm a') <= moment(appointmentStartTime, 'hh:mm a')) &&
                            (moment(appointmentEndTime, 'hh:mm a') <= moment(availability.endTime, 'hh:mm a'));
                    });
                }
                return true;
            };

            var filterTimingsBasedOnInput = function (enteredNumber, allowedList) {
                var showTimes = [];

                _.each(allowedList, function (time) {
                    (time.startsWith(enteredNumber) || (time.indexOf(enteredNumber) === 1 && (time.indexOf(0) === 0))) && showTimes.push(time);
                });

                return showTimes.length === 0 ? allowedList : showTimes;
            };

            $scope.onKeyDownOnStartTime = function () {
                $scope.showStartTimes = filterTimingsBasedOnInput($scope.appointment.startTime, $scope.startTimes);
            };

            $scope.onKeyDownOnEndTime = function () {
                $scope.showEndTimes = filterTimingsBasedOnInput($scope.appointment.endTime, $scope.endTimes);
            };

            $scope.onSelectStartTime = function (data) {
                setMinDuration();
                $scope.warning.startTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.startTime);
                if (moment($scope.appointment.startTime, 'hh:mm a', true).isValid()) {
                    $scope.appointment.endTime = moment($scope.appointment.startTime, 'hh:mm a').add($scope.minDuration, 'm').format('hh:mm a');
                    $scope.onSelectEndTime();
                }
            };

            var isSelectedSlotOutOfRange = function () {
                if ($scope.appointment.startTime && !($scope.warning.appointmentDate || $scope.warning.startTime || $scope.warning.endTime)) {
                    return !isAppointmentStartTimeAndEndTimeWithinServiceAvailability();
                }
                return false;
            };

            $scope.onSelectEndTime = function (data) {
                $scope.warning.endTime = false;
                $scope.checkAvailability();
                $scope.warning.endTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.endTime);
                $scope.warning.outOfRange = isSelectedSlotOutOfRange();
            };

            var triggerSlotCalculation = function () {
                if ($scope.appointment &&
                    $scope.appointment.service &&
                    $scope.appointment.date &&
                    $scope.appointment.startTime &&
                    $scope.appointment.endTime &&
                    _.isEmpty($scope.selectedService.serviceTypes)
                ) {
                    getSlotsInfo();
                }
            };

            $scope.responseMap = function (data) {
                if (typeof data === 'object' && data.givenName && data.identifier) {
                    data.label = data.givenName + (data.familyName ? " " + data.familyName : "") + " " + "(" + data.identifier + ")";
                }
                return data;
            };


            var clearAvailabilityInfo = function () {
                $scope.warning.appointmentDate = false;
                $scope.warning.startTime = false;
                $scope.warning.endTime = false;
                $scope.warning.outOfRange = false;
                clearSlotsInfo();
            };

            $scope.onSpecialityChange = function () {
                if (!$scope.appointment.specialityUuid) {
                    delete $scope.appointment.specialityUuid;
                }
                delete $scope.selectedService;
                delete $scope.appointment.service;
                delete $scope.appointment.serviceType;
                delete $scope.appointment.location;
                clearAvailabilityInfo();
            };

            $scope.onServiceChange = function () {
                clearAvailabilityInfo();
                delete $scope.appointment.serviceType;
                delete $scope.weeklyAvailabilityOnSelectedDate;
                if ($scope.appointment.service) {
                    setServiceDetails($scope.appointment.service).then(function () {
                        $scope.onSelectStartTime();
                    });
                }
            };

            function setMinDuration() {
                $scope.minDuration = Bahmni.Clinical.Constants.minDurationForAppointment;
                $scope.minDuration = $scope.appointment.serviceType ? $scope.appointment.serviceType.duration || $scope.minDuration
                    : $scope.appointment.service ? $scope.appointment.service.durationMins || $scope.minDuration : $scope.minDuration;
            }

            $scope.onServiceTypeChange = function () {
                if ($scope.appointment.serviceType) {
                    setMinDuration();
                    clearAvailabilityInfo();
                    $scope.onSelectStartTime();
                }
            };

            var getWeeklyAvailabilityOnADate = function (date, weeklyAvailability) {
                var dayOfWeek = moment(date).format('dddd').toUpperCase();
                return _.filter(weeklyAvailability, function (o) {
                    return o.dayOfWeek === dayOfWeek;
                });
            };

            var setServiceAvailableTimesForADate = function (date) {
                $scope.allowedStartTime = $scope.selectedService.startTime || '12:00 am';
                $scope.allowedEndTime = $scope.selectedService.endTime || '11:59 pm';

                if ($scope.selectedService.weeklyAvailability && $scope.selectedService.weeklyAvailability.length > 0) {
                    $scope.weeklyAvailabilityOnSelectedDate = getWeeklyAvailabilityOnADate(date, $scope.selectedService.weeklyAvailability);
                    if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length === 0) {
                        $scope.allowedStartTime = undefined;
                        $scope.allowedEndTime = undefined;
                    }
                }
            };

            var isServiceAvailableOnWeekDate = function (dayOfWeek, weeklyAvailability) {
                return _.find(weeklyAvailability, function (wA) {
                    return wA.dayOfWeek === dayOfWeek;
                });
            };

            var isSelectedDateHoliday = function (date) {
                return appointmentsServiceService.checkIfDateIsHoliday(date).then(function (response) {
                    return response.data
                })
            }

            $scope.checkAvailability = async function () {
                let isHoliday = false;
                let holidayMsg = "";
                let isDateWarning = false;
                let localLoad = $scope.currentLoad || 0;
                let localMaxLimit = $scope.maxAppointmentsLimit || 0;
                let localStartTimes = [];
                let localEndTimes = [];

                if (!$scope.isPastAppointment && $scope.selectedService && $scope.appointment.date) {
                    try {
                        const holidayResult = await isSelectedDateHoliday($scope.appointment.date);
                        const dayOfWeek = moment($scope.appointment.date).format('dddd').toUpperCase();

                        const startDateTime = getDateTime($scope.appointment.date, "00:00");
                        const endDateTime = getDateTime($scope.appointment.date, "23:59");
                        const loadResponse = await appointmentsServiceService.getServiceLoad($scope.selectedService.uuid, startDateTime, endDateTime);
                        localLoad = loadResponse.data;
                        if (holidayResult && holidayResult.is_holiday) {
                            isHoliday = true;
                            holidayMsg = `The selected date is Ethiopian holiday (${holidayResult.holiday_name}). Please select another date.`;
                        }

                        const appointmentDate = new Date($scope.appointment.date);
                        const appointmentDayMonth = ("0" + appointmentDate.getDate()).slice(-2) + '/' + ("0" + (appointmentDate.getMonth() + 1)).slice(-2);
                        if ($scope.holidays && $scope.holidays.includes(appointmentDayMonth)) {
                            isHoliday = true;
                            holidayMsg = holidayMsg || 'The selected date is a recorded holiday. Please select another date.';
                        }

                        let allSlots;
                        if (!_.isEmpty($scope.selectedService.weeklyAvailability)) {
                            allSlots = getSlotsForWeeklyAvailability(dayOfWeek, $scope.selectedService.weeklyAvailability, $scope.minDuration);
                            isDateWarning = !isServiceAvailableOnWeekDate(dayOfWeek, $scope.selectedService.weeklyAvailability);
                        } else {
                            allSlots = getAllSlots($scope.selectedService.startTime, $scope.selectedService.endTime, $scope.minDuration);
                        }
                        localStartTimes = allSlots.startTime || [];
                        localEndTimes = allSlots.endTime || [];

                        const dailyConfig = _.find($scope.selectedService.weeklyAvailability, function (avb) {
                            return avb.dayOfWeek === dayOfWeek;
                        });

                        if (dailyConfig && dailyConfig.maxAppointmentsLimit) {
                            localMaxLimit = dailyConfig.maxAppointmentsLimit;
                        } else if ($scope.selectedService.maxAppointmentsLimit) {
                            localMaxLimit = $scope.selectedService.maxAppointmentsLimit;
                        } else {
                            localMaxLimit = calculateMaxLoadFromDuration(dailyConfig || $scope.selectedService);
                        }

                        $timeout(function () {
                            $scope.warning.holiday = isHoliday;
                            $scope.holiday_warning_message = holidayMsg;
                            $scope.warning.appointmentDate = isDateWarning;

                            $scope.currentLoad = localLoad;
                            $scope.maxAppointmentsLimit = localMaxLimit;
                            $scope.availableSlots = Math.max(0, localMaxLimit - localLoad);

                            $scope.startTimes = localStartTimes;
                            $scope.endTimes = localEndTimes;

                            if (!$scope.isEditMode() && !isHoliday && !isDateWarning) {
                                if ($scope.currentLoad >= $scope.maxAppointmentsLimit) {
                                    $scope.appointment.startTime = null;
                                    $scope.appointment.endTime = null;
                                } else if ($scope.startTimes.length > localLoad) {
                                    $scope.appointment.startTime = $scope.startTimes[localLoad];
                                    $scope.onSelectStartTime();
                                }
                            }

                            $scope.warning.endTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.endTime);
                            $scope.warning.startTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.startTime);
                            $scope.warning.outOfRange = isSelectedSlotOutOfRange();
                            if (isHoliday) {
                                messagingService.showMessage('error', 'APPOINTMENT_DATE_IS_HOLIDAY');
                            }
                        });

                    } catch (e) {
                        console.error("CheckAvailability Error:", e);
                    }
                }
            };

            var setServiceDetails = function (service) {
                return appointmentsServiceService.getService(service.uuid).then(
                    function (response) {
                        $scope.selectedService = response.data;
                        $scope.appointment.location = _.find(appointmentCreateConfig.locations, { uuid: $scope.selectedService.location.uuid });
                        $scope.minDuration = response.data.durationMins || Bahmni.Clinical.Constants.minDurationForAppointment;
                    });
            };

            $scope.continueWithoutSaving = function () {
                $scope.showConfirmationPopUp = false;
                $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams, { reload: true });
                ngDialog.close();
            };

            $scope.continueWithSaving = function () {
                saveAppointment($scope.validatedAppointment);
                ngDialog.close();
            };

            $scope.cancelTransition = function () {
                $scope.showConfirmationPopUp = true;
                ngDialog.close();
            };

            $scope.displayConfirmationDialog = function () {
                return ngDialog.openConfirm({
                    template: 'dashboard/views/appointmentServiceNavigationConfirmation.html',
                    scope: $scope,
                    closeByEscape: true
                });
            };


            $scope.displayConflictConfirmationDialog = function () {
                ngDialog.openConfirm({
                    template: 'views/manage/appointmentConflictConfirmation.html',
                    scope: $scope,
                    closeByEscape: true
                });
            };

            $scope.$on("$destroy", function () {
                cleanUpListenerStateChangeStart();
            });

            var getSlotsForWeeklyAvailability = function (dayOfWeek, weeklyAvailability, durationInMin) {
                var slots = { startTime: [], endTime: [] };
                var dayAvailability = _.filter(weeklyAvailability, function (o) {
                    return o.dayOfWeek === dayOfWeek;
                });
                dayAvailability = _.sortBy(dayAvailability, 'startTime');
                _.each(dayAvailability, function (day) {
                    var allSlots = getAllSlots(day.startTime, day.endTime, durationInMin);

                    slots.startTime = _.concat(slots.startTime, allSlots.startTime);
                    slots.endTime = _.concat(slots.endTime, allSlots.endTime);
                });
                return slots;
            };

            var getAllSlots = function (startTimeString, endTimeString, durationInMin) {
                startTimeString = _.isEmpty(startTimeString) ? '00:00' : startTimeString;
                endTimeString = _.isEmpty(endTimeString) ? '23:59' : endTimeString;

                var startTime = getFormattedTime(startTimeString);
                var endTime = getFormattedTime(endTimeString);

                var result = [];
                var slots = { startTime: [], endTime: [] };
                var current = moment(startTime);

                while (current.valueOf() <= endTime.valueOf()) {
                    result.push(current.format('hh:mm a'));
                    current.add(durationInMin, 'minutes');
                }

                slots.startTime = _.slice(result, 0, result.length - 1);
                slots.endTime = _.slice(result, 1);

                return slots;
            };

            var getFormattedTime = function (time) {
                return moment(time, 'hh:mm a');
            };

            var isFormFilled = function () {
                return !_.every(_.values($scope.appointment), function (value) {
                    return !value;
                });
            };

            $scope.reloadRequested = false;

            var cleanUpListenerStateChangeStart = $scope.$on('$stateChangeStart',
                function (event, toState, toParams, fromState, fromParams) {
                    if ($scope.reloadRequested) {
                        $scope.reloadRequested = false;
                        return;
                    }

                    if (isFormFilled() && $scope.showConfirmationPopUp) {

                        ngDialog.close();
                        $scope.toStateConfig = { toState: toState, toParams: toParams };


                    }
                }
            );



            var newAppointmentStartingEndingBeforeExistingAppointment = function (existingStart, newStart, newEnd) {
                return newEnd <= existingStart;
            };

            var newAppointmentStartingEndingAfterExistingAppointment = function (newStart, existingStart, existingEnd) {
                return newStart >= existingEnd;
            };

            var isNewAppointmentConflictingWithExistingAppointment = function (existingAppointment, newAppointment) {
                var existingStart = moment(existingAppointment.startDateTime),
                    existingEnd = moment(existingAppointment.endDateTime);
                var newStart = moment(newAppointment.startDateTime),
                    newEnd = moment(newAppointment.endDateTime);
                return !(newAppointmentStartingEndingBeforeExistingAppointment(existingStart, newStart, newEnd) ||
                    newAppointmentStartingEndingAfterExistingAppointment(newStart, existingStart, existingEnd));
            };

            var checkForConflict = function (existingAppointment, newAppointment) {
                var isOnSameDay = moment(existingAppointment.startDateTime).diff(moment(newAppointment.startDateTime), 'days') === 0;
                var isAppointmentTimingConflicted = isNewAppointmentConflictingWithExistingAppointment(existingAppointment, newAppointment);
                return existingAppointment.uuid !== newAppointment.uuid &&
                    existingAppointment.status !== 'Cancelled' &&
                    isOnSameDay && isAppointmentTimingConflicted;
            };

            var getConflictingAppointments = function (appointment) {
                return _.filter($scope.patientAppointments, function (bookedAppointment) {
                    return checkForConflict(bookedAppointment, appointment);
                });
            };

            var saveAppointment = function (appointment) {
                return spinner.forPromise(appointmentsService.save(appointment).then(function () {
                    messagingService.showMessage('info', 'APPOINTMENT_SAVE_SUCCESS');
                    $scope.showConfirmationPopUp = false;
                    var params = $state.params;
                    params.viewDate = moment($scope.appointment.date).startOf('day').toDate();
                    params.isFilterOpen = true;
                    params.isSearchEnabled = params.isSearchEnabled && $scope.isEditMode();
                    $state.go('patient.dashboard.show', params, { reload: true });
                }));
            };

            var wireAutocompleteEvents = function () {
                $("#endTimeID").bind('focus', function () {
                    $("#endTimeID").autocomplete("search");
                });
                var $startTimeID = $("#startTimeID");
                $startTimeID.bind('focus', function () {
                    $("#startTimeID").autocomplete("search");
                });
            };

            $scope.isEditMode = function () {
                return $scope.appointment.uuid;
            };

            $scope.isEditAllowed = function () {
                return $scope.isPastAppointment ? false : ($scope.appointment.status === 'Scheduled' || $scope.appointment.status === 'CheckedIn');
            };

            $scope.navigateToPreviousState = function () {
                $state.go('patient.dashboard.show', $state.params, { reload: true });
            };

            $scope.canManageOwnAppointmentOnly = function () {
                return (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Clinical.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges) &&
                    !appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Clinical.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges));
            };

            $scope.isUserAllowedToRemoveProvider = function (providerUuid) {
                if ($scope.canManageOwnAppointmentOnly() &&
                    $rootScope.currentProvider.uuid !== providerUuid) {
                    return false;
                }
                return $scope.isEditAllowed();
            };

            $scope.doesAppointmentHaveProvider = function () {
                return $scope.appointment.providers.length === 0
                    || _.isUndefined(_.find($scope.appointment.providers, function (provider) {
                        return provider.response === Bahmni.Clinical.Constants.providerResponses.ACCEPTED;
                    }));
            };

            var isAppointmentWithSomeProviderButNotCurrentUser = function () {
                return _.isUndefined($scope.isCurrentProviderPartOfAppointment()) && !$scope.doesAppointmentHaveProvider();
            };

            $scope.isCurrentProviderPartOfAppointment = function () {
                return _.find($scope.appointment.providers, function (provider) {
                    return provider.uuid === $rootScope.currentProvider.uuid && provider.response != Bahmni.Clinical.Constants.providerResponses.CANCELLED;
                });
            };

            $scope.isFieldEditNotAllowed = function () {
                if ($scope.canManageOwnAppointmentOnly() && (isAppointmentWithMultipleProvider()
                    || isAppointmentWithSomeProviderButNotCurrentUser())) {
                    return true;
                }
                return !$scope.isEditAllowed();
            };
            $scope.reloadState = function () {
                $scope.reloadRequested = true;
                $state.go($state.current, {}, { reload: true });
            };



            var isAppointmentWithMultipleProvider = function () {
                return $scope.appointment.providers.length > 1;
            };
            return init();
        }]);