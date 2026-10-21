"use strict";

angular.module('ipd')
    .controller('ReferralPatientController', ['$scope', '$q', '$rootScope', '$state', 
        'encounterService', 'conceptSetService', 'sessionService', 
        'messagingService', '$stateParams', 'ngDialog','$http',
        function ($scope, $q, $rootScope, $state, encounterService, conceptSetService, sessionService, 
                  messagingService, $stateParams, ngDialog, $http) {

            $scope.observations = [];
            $scope.patientUuid = $stateParams.patientUuid;
            var locationUuid = sessionService.getLoginLocationUuid();
            var observationMapper = new Bahmni.ConceptSet.ObservationMapper();

            $scope.referralComplete = "Referral Complete";
            $scope.referredTo = "Referred to_bedmanagment";
            $scope.referralObservations = [];

            $scope.updateReferral = function () {
                var encounterData = getEncounterData();
                encounterData.observations = $scope.referralObservations;
                console.log("Encounter Data:", encounterData);
                console.log("Observations:", encounterData.observations);
                
                encounterService.create(encounterData).success(function (response) {
                    messagingService.showMessage('info', 'patient status updated')
                    ngDialog.close()
                    $state.go('home');
                })
            };

            //to prepare encounter data
            var getEncounterData = function () {
                var encounterData = {};
                encounterData.patientUuid = $scope.patientUuid;
                encounterData.encounterTypeUuid = $rootScope.encounterConfig.getConsultationEncounterTypeUuid();
                encounterData.observations = _.filter($scope.observations, function (observation) {
                    return !_.isEmpty(observation.value);
                });
                encounterData.locationUuid = locationUuid;
                return encounterData;
            };

            // initialize the concept set
            var init = function () {
                conceptSetService.getConcept({
                    name: "Referral complete",
                    v: "bahmni"
                }).then(function (response) {
                    var referralConcept = response.data.results[0];
                    var observation = observationMapper.map($scope.observations, referralConcept, []);
                    $scope.observations.push(observation);
                }).catch(function (error) {
                    console.error("Error fetching concept set:", error);

                conceptSetService.getConcept({
                    name: "Referred to_bedmanagment",
                    v: "bahmni"
                }).then(function (response) {
                    var referredToConcept = response.data.results[0];
                    var observation = observationMapper.map($scope.observations, referredToConcept, []);
                    $scope.observations.push(observation);
                }).catch(function (error) {
                    console.error("Error fetching 'Referred to_bedmanagment' concept set:", error);
                    });
                });
            };

            init();

        var fetchReferralData = function () {
            var params = {
                q: 'bahmni.sqlGet.patientsReferralOutData',
                patientUuid: $stateParams.patientUuid
            };
        
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                params: params,
                withCredentials: true
            }).then(function (response) {
                console.log("Full API Response:", response.data);
                if (response.data) {
                    const referralData = response.data[0];
                    console.log("Referral Data:", referralData);
                    $scope.referral = {
                        dateOfReferral: referralData["Date of referral"],
                        fromLocation: referralData["From: location"],
                        mainDiagnosis: referralData["Main diagnosis"],
                        physician: referralData["Physician"],
                        consultedSenior: referralData["Consulted Senior"],
                        referralReason: referralData["Referral reason"],
                        gender: referralData["sex"]
                    };
                    console.log("Formatted Referral Data:", $scope.referral);
                } else {
                    console.warn("No referral data found for patientUuid:", $stateParams.patientUuid);
                }
            }).catch(function (error) {
                console.error("Error fetching referral data:", error);
            });
        };
        fetchReferralData();

    }]);