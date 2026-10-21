'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('drugChart', ['appService', '$http', 'conceptSetService', '$q', 'spinner', 'observationsService', '$rootScope', function (appService, $http, conceptSetService, $q, spinner, observationsService, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                visitUuid: "=?",
                abnormalObs: '=?',
                patient: '=',
                fixed: '=?',
                printing: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {

                $scope.selectedMedication;
                const FORM_GROUP = "New Medication Information";
                var customRep = "custom:(groupMembers,obsGroup,uuid)"
                $scope.allMedications = [];

                var sortDate = function (arr) {
                    arr.sort(function (a, b) {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateB - dateA
                    })
                }

                $scope.sortMedicationsAlphabetically = function () {
                    $scope.allMedications.sort((a, b) => {
                        if (a.display < b.display) {
                            return -1;
                        } else if (a.name > b.name) {
                            return 1;
                        } else {
                            return 0;
                        }
                    });
                }
                
                var fetchData = function (patientUuid, formGroup, customRepresentation) {
                    if(!$scope.fixed){
                        var params = {
                            patient: patientUuid,
                            limit: 1000,
                            numberOfVisits: 1,
                            v: customRepresentation,
                            conceptNames: formGroup
                        };
                    return $http.get(Bahmni.Common.Constants.openmrsObsUrl, { params: params });
                    }
                    if($scope.fixed){
                        return observationsService.fetch(patientUuid, formGroup,
                            null, 1, $scope.visitUuid,null, null).then(function (response) {
                                return response.data;
                                
                            })
                    }
                };

                var getDateWithoutTime = function (dateTime) {
                    return dateTime ? new Date(dateTime).toLocaleDateString() : undefined;
                };

                var getPreviousValues = function () {
                    
                    return observationsService.fetch($scope.patient.uuid, $scope.observation.concept.name, null,1, $scope.visitUuid,null, null).then(function (response) {
                        var result = response.data
                        
                        var result = result.map(function (res) {
                            return JSON.parse(res.value).map(function (val) {
                                val.creator = res.creatorName;
                                val.obsDate = getDateWithoutTime(res.observationDateTime)
                                return val
                            })
                        })
                        
                        return result
                    })
                }

                var setPreviousValues = function () {
                    return getPreviousValues().then(function (results) {
                        var prevValues = results.flat()
                        return prevValues
                    })
                }

                var filterFetchedResults = function (results) {
                    return _.filter(results, function (result) {
                        return result.groupMembers.length > 1;
                    });
                }

                $scope.updateValue = function (medication, time, value) {

                    if (value == "YES") { time.givenLabel = "Given ✔"; time.notGivenLabel = "Not Given"; time.notGivenSelected = false; time.given = value; time.reason = "" }
                    else if (value == "NO") { time.notGivenLabel = "Not Given ✘"; time.givenLabel = "Given"; time.givenSelected = false; time.given = value }
                    else if (value == "UNSET") { time.givenLabel = "Given"; time.notGivenLabel = "Not Given"; time.given = ""; time.reason = "" }
                    $scope.valueChanged()
                }

                $scope.valueChanged = function () {
                    setObservationValue(
                        filterMedicationsWithNoData($scope.allMedications).map(function (medication) {
                            return {
                                "medication": medication.display,
                                "time": filterMedicationTimeWithNoData(medication.time).map(function (time) {
                                    return {
                                        toBeGiven: time.toBeGiven,
                                        given: time.given,
                                        reason: time.reason ? time.reason : ""
                                    }
                                }),
                                "status": medication.selectedStatus ? medication.selectedStatus : "",
                                "note": medication.note ? medication.note : ""
                            }
                        })
                    )
                }

                function isEmptyValue(value) {
                    return value === "" || value === null || value === undefined;
                }

                var setObservationValue = function (medications) {
                    var parsed = medications.map(function (medication) {
                        return Object.keys(medication).reduce(function (acc, key) {
                            var val = medication[key];
                            // handle arrays (e.g. time)
                            if (Array.isArray(val)) {
                                var arr = val.map(function (item) {
                                    if (item && typeof item === 'object') {
                                        return Object.keys(item).reduce(function (obj, ik) {
                                            var iv = item[ik];
                                            if (!isEmptyValue(iv)) {
                                                obj[ik] = iv;
                                            }
                                            return obj;
                                        }, {});
                                    }
                                    return item;
                                }).filter(function (i) {
                                    return !(i && typeof i === 'object' && Object.keys(i).length === 0);
                                });
                                if (arr.length) acc[key] = arr;
                            } else if (!isEmptyValue(val)) {
                                acc[key] = val;
                            }
                            return acc;
                        }, {});
                    })
                    $scope.observation.value = parsed.length > 0 ? JSON.stringify(parsed) : undefined
                }

                var filterMedicationsWithNoData = function (medications) {
                    return medications.filter(function (medication) {
                        return medication.selectedStatus || medication.time.some(function (time) {
                            return time.given
                        })
                    })
                }

                var filterMedicationTimeWithNoData = function (timeArray) {
                    return timeArray.filter(function (time) {
                        return time.given
                    })
                }

                var changeDrugOptions = function () {
                    _.forEach($scope.allMedications, function (medication) {
                        if (medication.prevStatus == 'hold')
                            medication.status = ['unhold', 'discontinue']
                    })
                }

                var uniqueSortedDates = function(arr){
                   var dates = (arr || []).filter(Boolean);
                   dates = _.uniq(dates);
                   sortDate(dates);
                   return dates;
               }

               var PAGE_SIZE = 1;

               var paginateDates = function(medication){
                   var dates = uniqueSortedDates(medication.datesOfObs || []);
                   medication.pagedDates = [];
                   for(var i = 0; i < dates.length; i += PAGE_SIZE){
                       medication.pagedDates.push(dates.slice(i, i + PAGE_SIZE));
                   }
                   medication.currentPage = 0;
                   medication.totalPages = Math.max(1, medication.pagedDates.length);
                   medication.visibleDates = medication.pagedDates[medication.currentPage] || [];
               }

               $scope.nextPage = function(medication){
                   if(medication.currentPage < medication.totalPages - 1){
                       medication.currentPage++;
                       medication.visibleDates = medication.pagedDates[medication.currentPage] || [];
                   }
               };

               $scope.prevPage = function(medication){
                   if(medication.currentPage > 0){
                       medication.currentPage--;
                       medication.visibleDates = medication.pagedDates[medication.currentPage] || [];
                   }
               };

                var init = function () {
                    
                    fetchData($scope.patient.uuid, FORM_GROUP, customRep).then(function (res) {
                        
                        var results = $scope.fixed ? res : res.data.results
                        results = filterFetchedResults(results);
                        if (results.length) {
                            _.forEach(results, function (result) {
                                var medication = Bahmni.ConceptSet.MedicationViewModel.create(result.groupMembers);
                                $scope.allMedications.push(medication)
                            })
                        }
                        setPreviousValues().then(function (prevValues) {
                            
                            _.forEach($scope.allMedications, function (medication) {
                                _.forEach(prevValues, function (prevValue) {
                                    if (medication.display == prevValue.medication) {
                                        // keep the latest status based on obsDate
                                        if (prevValue.status) {
                                            var prevObsDate = prevValue.obsDate ? new Date(prevValue.obsDate) : null;
                                            if (prevObsDate) {
                                                if (!medication.prevStatusDate || medication.prevStatusDate < prevObsDate) {
                                                    medication.prevStatus = prevValue.status;
                                                    medication.prevStatus == 'escalate' || medication.prevStatus == 'de-escalate' ?
                                                        prevValue.note ? medication.prevNote = prevValue.note : medication.prevNote = null : null
                                                    medication.prevStatusDate = prevObsDate;
                                                }
                                            } else if (!medication.prevStatus) {
                                                medication.prevStatus = prevValue.status;
                                            }
                                        }
                                        prevValue.time?.length > 0 ? medication.datesOfObs.push(prevValue.obsDate) : null
                                        _.forEach(medication.time, function (time) {
                                            _.forEach(prevValue.time, function (prevTime) {
                                                if (time.toBeGiven == prevTime.toBeGiven) {
                                                    time.prevValues.push({
                                                        givenBy: prevValue.creator,
                                                        given: prevTime.given == 'YES' ? "✅" : "❌",
                                                        date: prevValue.obsDate,
                                                        reason: prevTime.reason ? prevTime.reason : ""
                                                    })
                                                }
                                            })
                                        })
                                    }
                                })
                            })
                            changeDrugOptions();
                            _.forEach($scope.allMedications, function(med){
                               paginateDates(med);
                           });
                            if(!$scope.fixed && $scope.observation.value){
                            $scope.currentValue = JSON.parse($scope.observation.value);
                            _.forEach($scope.allMedications, function(medication){
                                _.forEach($scope.currentValue, function(currValue){
                                    if(medication.display == currValue.medication){
                                       medication.selectedStatus = currValue?.status
                                        _.forEach(medication.time, function(time){
                                            _.forEach(currValue.time, function(currTime){
                                            if(time.toBeGiven == currTime.toBeGiven){
                                                time.givenSelected = !time.givenSelected;
                                                $scope.updateValue(medication, time, currTime.given)
                                            }
                                        })
                                    })
                                }})
                            })
                            
                        }
                        })
                    })
                }

                init();

            },
            templateUrl: '../common/concept-set/views/observationDataTypes/drugChart.html'
        };
    }]);