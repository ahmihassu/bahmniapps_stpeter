'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('tab', ['appService', '$http', 'conceptSetService', '$rootScope', 'spinner','observationsService','$stateParams', function (appService, $http, conceptSetService, $rootScope, spinner,observationsService,$stateParams) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                rootObs: '=',
                patient: '=',
                fixed: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                $scope.datesOfObs = [];
                $scope.isPaired  = $scope.observation.concept.description ? $scope.observation.concept.description.includes('paired'): undefined
                $scope.conceptElements = [];
                $scope.rootObs = !$scope.rootObs ? $scope.observation : $scope.rootObs
                var customRep = "custom:(obsDatetime,obsGroup,uuid,value,groupMembers,display,concept:(display,conceptClass))"
                var customRepForm = "custom:(groupMembers:(uuid),concept:(name:(name)))"
                $scope.offset = 0
                const NUMBER_OF_RECORDS_PER_PAGE = 5;

                var destructureObs = function (obs, arr) {
                    if (obs.groupMembers?.length > 0) {
                        _.forEach(obs.groupMembers, function (member) {
                            if(!member.hidden)
                                arr.push(member)
                            if (member.concept.conceptClass != "Concept Details" && !$scope.isPaired)
                                destructureObs(member, arr)
                        })
                    }
                }
                var constructDateColumn = function (member) {
                    var dateTime = new Date(member?.obsDatetime || member?.observationDateTime).toLocaleDateString() + " " + new Date(member?.obsDatetime || member?.observationDateTime).toLocaleTimeString();
                    if (!$scope.datesOfObs.includes(dateTime)) {
                        $scope.datesOfObs.push(dateTime)
                    }
                }

                var sortDate = function (arr) {
                    arr.sort(function (a, b) {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateB - dateA
                    })
                }
             
                var setPreviousValues = function (results, observation) {
                    observation.prevValues = []
                    if (results && results.length > 0) {
                        _.forEach(results, function (result) {
                            constructDateColumn(result)
                            if (!observation.isObservationNode && observation.concept.conceptClass != "Concept Details") {
                                observation.prevValues.push({
                                    obsDate: (new Date(result?.obsDatetime || result?.observationDateTime)).toLocaleDateString() + " " + new Date(result?.obsDatetime || result?.observationDateTime).toLocaleTimeString(),
                                    value: result.value && (typeof result.value === 'object') ? result.value.display || result.value.name : result.value,
                                    name: result.concept.display
                                })
                                if ($scope.isPaired) {
                                    _.forEach(result.groupMembers,function(result){
                                        _.forEach(observation.groupMembers, function(member){
                                            if(member.concept.name ==result.concept.display){
                                                if(!member.prevValues)
                                                    member.prevValues = [];

                                                member.prevValues.push({
                                                    obsDate: (new Date(result?.obsDatetime || result?.observationDateTime)).toLocaleDateString() + " " + new Date(result?.obsDatetime || result?.observationDateTime).toLocaleTimeString(),
                                                    value: result.value,
                                                    name: result.concept.display
                                                })
                                            }
                                            })

                                        })
                                        }
                                    }
                            if (observation.concept.conceptClass == "Concept Details") {
                                if($scope.fixed){
                                    var val = result.value
                                    var abn = result.isAbnormal
                                }
                                else{
                                    var val = result.display ? result.display.split(':')[1] : ""
                                    var abn = val.match(/[a-zA-Z]+/g)[0]
                                }
                                observation.prevValues.push({
                                    obsDate: (new Date(result?.obsDatetime || result?.observationDateTime)).toLocaleDateString() + " " + new Date(result?.obsDatetime || result?.observationDateTime).toLocaleTimeString(),
                                    value: $scope.fixed ? result.value : val.match(/\d+(\.\d+)?/g)[0] ,
                                    isAbnormal: String(abn) == "true" ? { 'color': 'red' } : { 'color': 'black' },
                                    name: result.concept.display,
                                })
                            }
                        })
                    }

                    sortDate($scope.datesOfObs)
                }

                var fetchData = function (patientUuid, formGroup, customRepresentation,visitUuid) {
                    if (!$scope.fixed) {
                        var params = {
                            patient: patientUuid,
                            limit: 50,
                            numberOfVisits: 1,
                            v: customRepresentation,
                            conceptNames: formGroup
                         };
                        return $http.get(Bahmni.Common.Constants.openmrsObsUrl, { params: params });
                };
                if($scope.fixed){
                    return observationsService.fetch(patientUuid, formGroup, null, 1, visitUuid ,null, null).then(function (response) {
                            return response.data; 
                        })
                }
            }

                var getFormData = function (observations) {
                     var visitUuid = $stateParams.visitUuid

                       spinner.forPromise(fetchAllRecords(visitUuid).then(function (res) {
                                $scope.allResults = filterFormResults(res)
                                var sectionedResult = sectionResults($scope.allResults)
                                
                                var members = groupObservations(sectionedResult) 

                                _.forEach(observations, function (observation) {
                                    var results = members.filter(function(member){
                                        return member.concept.uuid == observation.concept.uuid
                                    })
                                    
                                     setPreviousValues(results, observation)
                                })
                                     
                            }))
                        
                }

                $scope.navigateResults = function (direction){
                    $scope.datesOfObs = []
                    var sectionedResult = sectionResults($scope.allResults,direction)
                                var members = groupObservations(sectionedResult) 
                                _.forEach($scope.conceptElements, function (observation) {
                                    var results = members.filter(function(member){
                                        return member.concept.uuid == observation.concept.uuid
                                    })
                                     setPreviousValues(results, observation)
                                })
                }

                var fetchAllRecords = function (visitUuid){
                    return fetchData($scope.patient.uuid, $scope.observation.concept.name, customRep, visitUuid).then(function (res) {
                            return res?.data?.results || res
                            })
                }

                var sectionResults = function (arr, direction) {
                    if (arr.length === 0) return [];

                    if (direction === 'forward') {
                        if ($scope.offset + NUMBER_OF_RECORDS_PER_PAGE < arr.length) {
                            $scope.offset += NUMBER_OF_RECORDS_PER_PAGE;
                        }
                    } else if (direction === 'backward') {
                        if ($scope.offset - NUMBER_OF_RECORDS_PER_PAGE >= 0) {
                            $scope.offset -= NUMBER_OF_RECORDS_PER_PAGE;
                        }
                    }

                    var start = $scope.offset;
                    var end = Math.min(start + NUMBER_OF_RECORDS_PER_PAGE, arr.length);
                    return arr.slice(start, end);
                }

                var groupObservations = function (arr){
                    var members = [];
                        for (var i = 0; i < arr.length; i++){
                            destructureObs(arr[i], members)
                            }
                        return members                
                    }

                var filterFormResults = function (arr){
                    if(isFormTab()){
                        if($scope.fixed)
                            return arr.filter(function(result){
                                return result?.obsGroupUuid == undefined
                            })
                        else
                            return arr.filter(function(result){
                                return result?.obsGroup == undefined
                            })
                        }
                    if(!isFormTab()){
                        if($scope.fixed)
                            return arr.filter(function(result){
                                return result?.obsGroupUuid == $scope.rootObs.uuid
                            })
                        else
                            return arr.filter(function(result){
                                return result?.obsGroup?.concept.uuid == $scope.rootObs.concept.uuid
                            })
                        }
                }

                var isFormTab = function (){
                    return $scope.observation.concept.name == $scope.rootObs.concept.name
                }

                var isObsCloned = function () {
                    var members = $scope.observation.groupMembers
                    if (members[0] && members[1]) {
                        return members[0].concept.uuid == members[1].concept.uuid
                    }
                    else
                        return false
                }

                var cloneNew = function (observation, parentObservation) {
                    var newObs = observation.cloneNew();
                    parentObservation.groupMembers.push(newObs)
                    $scope.$root.$broadcast("event:addMore", newObs);
                };

                $scope.resetConcept = function () {
                    
                    $scope.conceptElements = []
                      conceptSetService.getConcept({ name: $scope.observation.concept.name, v: "bahmni" }).then(function (response) {
                        var concept = response.data.results[0]
                        $scope.isPaired = concept.descriptions.length > 0 ? concept.descriptions[0].description.includes('paired') : undefined
                        var observationMapper = new Bahmni.ConceptSet.ObservationMapper();
                        var obs = observationMapper.map([], concept, null)
                        $scope.observation.groupMembers = obs.groupMembers;
                        
                        destructureObs($scope.observation, $scope.conceptElements)
                        getFormData($scope.conceptElements)
                    });

                }

            var calculateTotalEWSscore = function (){
                var totalEWSscore = 0;
                for (var i = 0; i < $scope.conceptElements.length;  i++){
                    if($scope.conceptElements[i].concept.displayString.toLowerCase().includes(' score') && $scope.conceptElements[i].concept.displayString != "Total EWS Score" && $scope.conceptElements[i].concept.displayString != "Total EWS Score (Paediatric)" && !isNaN($scope.conceptElements[i].value)) {
                        totalEWSscore = $scope.conceptElements[i].value ? totalEWSscore + $scope.conceptElements[i].value : totalEWSscore    
                    }
                }
                return totalEWSscore;
            }

            var load = function () {
                return appService.loadConfig('warning_score_chart.json').then(res => {
                        $scope.lookup = res             
                    })
                };
                
            load();

            var scoreLookUp = function (scoreSet, value){
                if(!scoreSet)
                    return null;

                for (let i = 0; i < scoreSet.length; i++) {
                    if (value >= scoreSet[i].min && value <= scoreSet[i].max) {
                        return scoreSet[i].score;
                        }
                    else if (value?.name?.display && value.name.display == scoreSet[i].level) {
                        return scoreSet[i].score;
                        }
                    }

                return null;
            }
                
            $scope.setWarningScore = function(obs){
                var obsScoreSet = $scope.lookup[obs.concept.displayString];
                var score = obs.value ? scoreLookUp(obsScoreSet, obs.value) : undefined;
                
                    $scope.conceptElements = $scope.conceptElements.map(function(element){
                        var name = obs.concept.displayString + " score"
                        if(element.concept.displayString.toLowerCase() == name.toLowerCase() && obs.value){
                            element.value = score
                            return element
                        }
                        else if(element.concept.displayString.toLowerCase() == name.toLowerCase()  && !obs.value){
                            element.value = undefined
                            return element
                        }
                        else if(element.concept.displayString.toLowerCase() == "total ews score"){
                            element.value = calculateTotalEWSscore()
                            return element
                        }
                        else return element
                        })
                
                    }


                if (!$scope.fixed) {
                    if (isObsCloned()) {
                        $scope.observation.groupMembers = _.filter($scope.observation.groupMembers, function (member, idx, arr) {
                            if (arr[idx + 1]) {
                                if (member.concept.uuid != arr[idx + 1].concept.uuid)
                                    return member
                            }
                            else
                                return member
                        })
                    }

                    destructureObs($scope.observation, $scope.conceptElements)
                    getFormData($scope.conceptElements)

                }
                if ($scope.fixed) {
                    conceptSetService.getConcept({ name: $scope.observation.concept.name, v: "bahmni" }).then(function (response) {
                        var concept = response.data.results[0]
                        $scope.isPaired = concept.descriptions.length > 0 ? concept.descriptions[0].description.includes('paired') : undefined
                        var observationMapper = new Bahmni.ConceptSet.ObservationMapper();
                        var obs = observationMapper.map([], concept, null)
        
                        destructureObs(obs, $scope.conceptElements)
                        getFormData($scope.conceptElements)
                    });
                }

            },
            templateUrl: '../common/concept-set/views/observationDataTypes/table.html'
        }
    }
    ])