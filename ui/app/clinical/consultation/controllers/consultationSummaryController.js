'use strict';

angular.module('bahmni.clinical')
    .controller('ConsultationSummaryController', ['$http', '$scope', 'conceptSetUiConfigService', 'visitService', 'messagingService', '$bahmniCookieStore', 'locationService', '$q', '$rootScope', function ($http, $scope, conceptSetUiConfigService, visitService, messagingService, $bahmniCookieStore, locationService, $q, $rootScope) {
        $scope.activeVisitType = $scope.$parent.activeVisit.visitType.name
        
        var geEditedDiagnosesFromPastEncounters = function () {
            var editedDiagnosesFromPastEncounters = [];
            $scope.consultation.pastDiagnoses.forEach(function (pastDiagnosis) {
                if (pastDiagnosis.isDirty && pastDiagnosis.encounterUuid !== $scope.consultation.encounterUuid) {
                    editedDiagnosesFromPastEncounters.push(pastDiagnosis);
                }
            });
            return editedDiagnosesFromPastEncounters;
        };
        $scope.editedDiagnosesFromPastEncounters = geEditedDiagnosesFromPastEncounters();
       
        var encounterConfig = $rootScope.encounterConfig;
        var getVisitTypes = function () {
        return $q.when(encounterConfig.getVisitTypes());
        };

        var fetchData = function (patientUuid, formGroup, customRepresentation) {
            var params = {
                patient: patientUuid,
                limit: 1,
                numberOfVisits: 1,
                v: customRepresentation,
                conceptNames: formGroup
            };
            return $http.get(Bahmni.Common.Constants.openmrsObsUrl, {params: params});
        };

        fetchData($scope.patient.uuid, ["Consultation Note"], "custom:(value)").then(res => {
            if (res.data.results.length) {
                let parsedData = JSON.parse(res.data.results[0].value)
                if(!parsedData.done) {
                    $scope.consultation.consultationNote.valueOne = parsedData.valueOne;
                    $scope.consultation.consultationNote.valueTwo = parsedData.valueTwo;
                    $scope.selectedConsultation = parsedData.dest;
                }
            }
        });

        getVisitTypes().then(function (data) {
            $scope.visitType = data;
        });
        
        var getLinkageUuid = function () {
            var params = {
                q: "bahmni.sqlGet.linkageUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };        

        $scope.link = function(selectedVisitType){
            var selectedVisit= _.filter($scope.visitType, function (visitType) {
                return visitType.name === selectedVisitType;
            });

            if(selectedVisit.length > 0) {
                getLinkageUuid().then(function(r){
                    var visitDetails = {patient: $scope.patient.uuid, visitType: selectedVisit[0].uuid, location: r.data[0].visitLocationUuid, attributes:[{value :$scope.$parent.activeVisit.visitType.uuid, attributeType:r.data[0].uuid}]}; 
                    visitService.endVisit($scope.$parent.activeVisit.uuid);
                    visitService.createVisit(visitDetails)
                    messagingService.showMessage('info', 'patient is linkage completed successfully.');    
                })
          
            }

        }

        $scope.onNoteChanged = function () {
            let currentValue = {
                valueOne: $scope.consultation.consultationNote.valueOne,
                valueTwo: $scope.consultation.consultationNote.valueTwo,
                dest: $scope.selectedConsultation,
                done: $scope.conFinished
            };
            $scope.consultation.consultationNote.value = JSON.stringify(currentValue);
//        TODO: Mihir, D3 : Hacky fix to update the datetime to current datetime on the server side. Ideal would be void the previous observation and create a new one.
            $scope.consultation.consultationNote.observationDateTime = null;
        };

        var groupObservations = function () {
            var allObservations = $scope.consultation.observations;
            allObservations = _.filter(allObservations, function (obs) {
                if (obs.concept.name === 'Dispensed') {
                    return false;
                }
                if ($scope.followUpConditionConcept && obs.concept.uuid === $scope.followUpConditionConcept.uuid) {
                    return false;
                }
                return true;
            });
            return new Bahmni.Clinical.ObsGroupingHelper(conceptSetUiConfigService).groupObservations(allObservations);
        };

        $scope.groupedObservations = groupObservations();
        $scope.disposition = $scope.consultation.disposition;
        $scope.toggle = function (item) {
            item.show = !item.show;
        };

        $scope.isConsultationTabEmpty = function () {
            if (_.isEmpty($scope.consultation.newlyAddedDiagnoses) && _.isEmpty($scope.groupedObservations) &&
                _.isEmpty($scope.consultation.newlyAddedSpecimens) && _.isEmpty($scope.consultation.consultationNote.value) &&
                _.isEmpty($scope.consultation.investigations) && _.isEmpty($scope.consultation.disposition) &&
                _.isEmpty($scope.consultation.treatmentDrugs) && _.isEmpty($scope.consultation.newlyAddedTreatments) &&
                _.isEmpty($scope.consultation.discontinuedDrugs) && _.isEmpty($scope.consultation.savedDiagnosesFromCurrentEncounter)) {
                return true;
            }
            return false;
        };
    }]);

