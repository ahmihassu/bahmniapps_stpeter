'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('medicationChart', ['appService', '$http','conceptSetService','$q', 'spinner','observationsService', function (appService, $http,conceptSetService,$q,spinner,observationsService) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                visitUuid: "=?",
                abnormalObs: '=?',
                patient:'=',
                fixed: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {

                var obsPrevValue = $scope.observation.value ? $scope.observation.value : " "

                $scope.datesOfObs = [];
                $scope.prevValues = [];
                $scope.prevStatus = [];
                $scope.selectedMedication;
                const FORM_GROUP = "New Medication Information";
                var customRep = "custom:(groupMembers,obsGroup,uuid)"
                $scope.allMedications = [];
                $scope.medications = [];

                $scope.onSelect = function(){
                    $scope.medications = $scope.allMedications.filter(function(medication){
                        return medication.display === $scope.selectedMedication
                    })
                }

                $scope.changeStatus = function(medication,medStat){
                    if($scope.observation.comment){
                        var tempComment = $scope.observation.comment.trim().split(' ')
                            for (let i = 0 ; i < tempComment.length ; i++)
                                if(tempComment[i].split('_')[0] == medication.uuid)
                                    tempComment.splice(i,1)

                        $scope.observation.comment = tempComment.join(" ")
                    }
                    else 
                        $scope.observation.comment = " "
                    
                    $scope.observation.comment += " " + medication.uuid + "_" + medStat
                    
                    if(medStat == "hold"){
                        for (let i=0; i < $scope.allMedications.length; i++){
                            if(medication.uuid == $scope.allMedications[i].uuid)
                                medication["status"] = "hold"
                            }
                        }
                    if(medStat == "discontinue"){
                        for (let i=0; i < $scope.allMedications.length; i++){
                                if(medication.uuid == $scope.allMedications[i].uuid)
                                    medication["status"] = "discontinue"
                                }
                            }
                    if(medStat == "con"){
                        for (let i = 0; i < $scope.allMedications.length; i++){
                            if(medication.uuid == $scope.allMedications[i].uuid)
                                medication["status"] = ""
                                }
                            }
                    $scope.observation.value += " "
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
                else if($scope.fixed){
                    return observationsService.fetch(patientUuid, formGroup,
                        null, 1, $scope.visitUuid,null, null).then(function (response) {
                            return response.data;
                            
                        })
                }
                };

                var sortDate = function (arr) {
                    arr.sort(function (a, b) {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateB - dateA
                    })
                }

                $scope.sortMedicationsAlphabetically = function(){                   
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
                
                var sortByTime = function (arr){
                    arr.sort((a, b) => {
                        const dateA = new Date('01/01/2024 ' + a.toBeGiven);
                        const dateB = new Date('01/01/2024 ' + b.toBeGiven);
                        
                        return dateA.getTime() - dateB.getTime();
                      });
                }


                var getMedicationFormFields = function(){
                    var deferred = $q.defer();
                    conceptSetService.getConcept({ name: FORM_GROUP, v: "custom:(setMembers:(name:(name)))" }).then(function (response){
                        var results = response.data.results[0].setMembers
                        var formFields = []
                        _.forEach(results, function(result){
                           formFields.push(result.name.name) 
                        })
                        deferred.resolve(formFields)
                        
                    })
                    return deferred.promise
                }

                var constructDateColumn = function (member) {
                    var dateTime = !$scope.fixed ? member.obsDatetime : member.observationDateTime
                    var dateOfObs = new Date(dateTime).toLocaleDateString() 
                    if (!$scope.datesOfObs.includes(dateOfObs)) {
                        $scope.datesOfObs.push(dateOfObs)
                    }
                }

                var formatValues = function (result){
                    var prevValues = []
                        constructDateColumn(result)
                        if(result.value){
                            var resultValue = result.value.split(" ")

                        _.forEach(resultValue,function(value){
                            if(value){
                            var dateTime = !$scope.fixed ? result.obsDatetime : result.observationDateTime
                            prevValues.push({
                                obsDate: new Date(dateTime).toLocaleDateString(),
                                uuid : value.split('_')[0],
                                givenBy : value.split('_')[1],
                            })
                        }
                    })
                }
                return prevValues
                }

                var formatStatus = function(result){
                    var prevStatus = []
                    if(result.comment){
                        var resultStatus = result.comment.split(" ")
                        
                        _.forEach(resultStatus,function(status){
                            if(status){
                            var dateTime = !$scope.fixed ? result.obsDatetime : result.observationDateTime
                            prevStatus.push({
                                obsDate: new Date(dateTime),
                                uuid : status.split('_')[0],
                                status : status.split('_')[1]
                            })
                        }
                    })
                    }
                    return prevStatus
                }

                var setStatus = function(){
                   
                        _.forEach($scope.allMedications, function(medication){
                            for (let i = 0; i < $scope.prevStatus.length; i++){
                                if($scope.prevStatus[i] && medication.uuid == $scope.prevStatus[i].uuid){
                                    if(medication.status){
                                        medication.status = medication["statusDate"] < $scope.prevStatus[i].obsDate ? $scope.prevStatus[i].status : medication.status
                                    }
                                    else{
                                        medication["status"] = $scope.prevStatus[i].status
                                        medication["statusDate"] = $scope.prevStatus[i].obsDate
                                    }
                                    }
                            }
                        })
                        
                }

                var getPreviousValues = function (){
                    var prevStatus = []
                    var prevValues = []
                    return fetchData($scope.patient.uuid,  "Medication Admin Sheet", 'custom:(comment,obsDatetime,value)').then(function (res) {
                        var results = $scope.fixed ? res : res.data.results
                        _.forEach(results,function(result){    
                            prevValues = prevValues.concat(formatValues(result))
                            prevStatus = prevStatus.concat(formatStatus(result))
                         })
                         return [prevStatus,prevValues]
                    });
                }

                var formatMedications = function (medicationProps,medicationUuid){
                    var medication = {display: "", time:[]};
                    return getMedicationFormFields().then(function(formFields){
                        _.forEach(medicationProps,function(medicationProp){
                            for(let i = 0 ; i < formFields.length; i++){
                                if(medicationProp.concept?.display == formFields[i] || medicationProp.concept?.name == formFields[i]){
                                    if(medicationProp.concept?.display?.includes("Time")  || medicationProp.concept?.name?.includes("Time")){
                                        var date  = new Date();
                                        date = date.toString().slice(0, 16)
                                        var time = moment(date + medicationProp.value).add(3,'h').format("hh:mm A");
                                        
                                    }                                  
                                    (medicationProp.concept?.display?.includes("Time")  || medicationProp.concept?.name?.includes("Time")) ? 
                                    medication.time.push({toBeGiven  :  $scope.fixed ? time : new Date(medicationProp.value).toLocaleTimeString(), uuid: medicationProp.uuid, givenBy: "",prevValues : []}) : 
                                    medication[formFields[i]] = medicationProp.value 
                            }
                           }
                        })
                        medication.display = medication["New Drug Name"] + ", " + medication["Drug dose"] + ", " + medication["Drug Route"] + ", " + medication["Drug Frequency"]
                        medication.uuid = medicationUuid
                        sortByTime(medication.time)
                        return medication
                    })
                }

                $scope.valueChanged = function(){                 
                    $scope.observation.value =  obsPrevValue ? obsPrevValue : " ";
                    _.forEach($scope.allMedications,function(medication){
                        _.forEach(medication.time,function(time){
                            if(time.givenBy){
                                $scope.observation.value += time.uuid + "_" + time.givenBy + " "
                            }
                                
                        })
                    })
                }
                var formatedMedication = function(result){
                        return formatMedications(result.groupMembers,result.uuid).then(function(medication){
                           return medication
                        }
                       )
                }
                var init = function (){
                    var deferred = $q.defer()
                    var medications = []
                    var promises = []
                    return fetchData($scope.patient.uuid,FORM_GROUP, customRep).then(function (res) {
                        var results = $scope.fixed ? res : res.data.results
                        if(results.length){
                            _.forEach(results,function(result){
                               var promise = formatedMedication(result).then(function(medication){
                                medications.push(medication)
                               }) 
                               promises.push(promise)
                             }) 
                        }
                        $q.all(promises).then(function(){
                            deferred.resolve(medications)
                        })
                        return deferred.promise
                    });
                }

               
               $q.all([init(),getPreviousValues()]).then(function(result){
                $scope.allMedications = result[0]
                $scope.prevStatus = result[1][0]
                $scope.prevValues = result[1][1]
                sortDate($scope.datesOfObs)
                setStatus()
               }
            )  
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/medicationChart.html'
        };
    }]);