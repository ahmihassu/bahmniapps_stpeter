'use strict';

(function () {
    var getAddress = function ($scope) {
        var patient = $scope.patient;
        var address = [];
        if ($scope.config.addressFields != undefined && $scope.config.addressFields.length != 0) {
            $scope.config.addressFields.forEach(function (addressField) {
                if (patient.address[addressField]) {
                    address.push(patient.address[addressField]);
                }
            });
        } else if (!_.includes($scope.config, "cityVillage")) {
            address.push(patient.address["cityVillage"]);
        }
        return address.join(", ");
    };
  var getPatientAttributeTypes = function ($scope) {
    var patient = $scope.patient;
        var originalAgeText = patient.ageText;
        var shouldShowHoursMinutes = false;
    var exactAgeInHours = null;
    var exactAgeInMinutes = null;
    
    if (patient.birthdate) {
        try {
            var birthDateTime = null;
            var now = new Date();
            
            if (patient.birthdate instanceof Date) {
                birthDateTime = new Date(patient.birthdate);
            } else if (typeof patient.birthdate === 'string') {
                birthDateTime = new Date(patient.birthdate);
            }
      if ($scope.adjustedBirthtime instanceof Date && birthDateTime) {
                birthDateTime.setHours(
                    $scope.adjustedBirthtime.getHours(),
                    $scope.adjustedBirthtime.getMinutes(),
                    $scope.adjustedBirthtime.getSeconds(),
                    $scope.adjustedBirthtime.getMilliseconds()
                );
            } else if (patient.birthtime instanceof Date && birthDateTime) {
                birthDateTime.setHours(
                    patient.birthtime.getHours(),
                    patient.birthtime.getMinutes(),
                    patient.birthtime.getSeconds(),
                    patient.birthtime.getMilliseconds()
                );
            }
            
            if (birthDateTime && !isNaN(birthDateTime.getTime())) {
                var ageInMs = now - birthDateTime;
                exactAgeInHours = Math.floor(ageInMs / (1000 * 60 * 60));
                exactAgeInMinutes = Math.floor(ageInMs / (1000 * 60));
                
                if (exactAgeInHours >= 0 && exactAgeInHours < 24) {
                    shouldShowHoursMinutes = true;
                }
            }
        } catch(e) {
            console.log("Error calculating age:", e);
        }
    }
        if (shouldShowHoursMinutes && exactAgeInHours !== null) {
        var remainingMinutes = exactAgeInMinutes % 60;
        
        if (exactAgeInHours === 0) {
            patient.ageText = exactAgeInMinutes.toString() + " <span> minute(s) </span>";
        } else {
            if (remainingMinutes > 0) {
                patient.ageText = exactAgeInHours.toString() + " <span> hour(s) </span> " + 
                                remainingMinutes.toString() + " <span> minute(s) </span>";
            } else {
                patient.ageText = exactAgeInHours.toString() + " <span> hour(s) </span>";
            }
        }
    } 
    else {
        if (originalAgeText && originalAgeText !== '0 <span> years </span>') {
            patient.ageText = originalAgeText;
        }
                 }
        var patientAttributeTypes = [patient.genderText, patient.ageText];
        if (patient.bloodGroupText) {
            patientAttributeTypes.push(patient.bloodGroupText);
        }
        return patientAttributeTypes.join(", ");
    };
    var isAdmitted = function (admissionStatus) {
        return _.get(admissionStatus, 'value') === "Admitted";
    };
    angular.module('bahmni.common.displaycontrol.patientprofile')
        .directive('patientProfile', ['patientService', 'spinner', '$sce', '$rootScope', '$stateParams', '$window', '$translate',
            'configurations', '$q', '$http' ,'visitService', 'observationsService', 'paymentStatusService',
            function (patientService, spinner, $sce, $rootScope, $stateParams, $window, $translate, configurations, $q, $http, visitService, observationsService, paymentStatusService) {
                var controller = function ($scope) {
                    $scope.isProviderRelationship = function (relationship) {
                        return _.includes($rootScope.relationshipTypeMap.provider, relationship.relationshipType.aIsToB);
                    };
                    console.log("Triage Color Result");
                    observationsService.fetch($scope.patientUuid, "Triage Color Result").then(function (response) {
                        if(response.data.length!=0){
                            $scope.triageStatus= response.data[0].value;
                        }
                    });
                    console.log($scope)
                    $scope.style = function() {
                        return { "background-color": $scope.triageStatus };
                    }
                    $scope.openPatientDashboard = function (patientUuid) {
                        var configName = $stateParams.configName || Bahmni.Common.Constants.defaultExtensionName;
                        $window.open("../clinical/#/" + configName + "/patient/" + patientUuid + "/dashboard");
                    };
                    var assignPatientDetails = function () {
                        var patientMapper = new Bahmni.PatientMapper(configurations.patientConfig(), $rootScope, $translate);
                        return patientService.getPatient($scope.patientUuid).then(function (response) {
                            var openMrsPatient = response.data;
                            $scope.patient = patientMapper.map(openMrsPatient);
                            if ($scope.patient.birthtime && $scope.patient.birthtime instanceof Date) {
                                $scope.adjustedBirthtime = new Date($scope.patient.birthtime.getTime() - (3 * 60 * 60 * 1000));
                            } else {
                                $scope.adjustedBirthtime = $scope.patient.birthtime;
                            }
                        });
                    };
                    var assignRelationshipDetails = function () {
                        return patientService.getRelationships($scope.patientUuid).then(function (response) {
                            $scope.relationships = response.data.results;
                        });
                    };
                    var assignAdmissionDetails = function () {
                        var REP = "custom:(attributes:(value,attributeType:(display,name)))";
                        var ADMISSION_STATUS_ATTRIBUTE = "Admission Status";
                        return visitService.getVisit($scope.visitUuid, REP).then(function (response) {
                            var attributes = response.data.attributes;
                            var admissionStatus = _.find(attributes, {attributeType: {name: ADMISSION_STATUS_ATTRIBUTE}});
                            $scope.hasBeenAdmitted = isAdmitted(admissionStatus);
                        });
                    };
                    var setHasBeenAdmittedOnVisitUuidChange = function () {
                        $scope.$watch('visitUuid', function (visitUuid) {
                            if (!_.isEmpty(visitUuid)) {
                                assignAdmissionDetails();
                            }
                        });
                    };
                    var getOxygenUuid = function () {
                         var params = {
                            q: "bahmni.sqlGet.oxygenUuid",
                            id: $scope.patient.identifier
                        };
                        return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                            method: "GET",
                            params: params,
                            withCredentials: true
                        });
                    };
                    var setDirectiveAsReady = function () {
                        $scope.isDirectiveReady = true;
                    };
                    var onDirectiveReady = function () {
                        $scope.addressLine = getAddress($scope);
                        $scope.patientAttributeTypes = $sce.trustAsHtml(getPatientAttributeTypes($scope));
                        $scope.showBirthDate = $scope.config.showDOB !== false;
                        $scope.showBirthDate = $scope.showBirthDate && !!$scope.patient.birthdate;
                    };
                    var initPromise = $q.all([assignPatientDetails(), assignRelationshipDetails()]);
                    initPromise.then(onDirectiveReady);
                    initPromise.then(setHasBeenAdmittedOnVisitUuidChange);
                    initPromise.then(setDirectiveAsReady);
                    initPromise.then(function () {
                        if ($scope.patient && $scope.patient.identifier) {
                            getOxygenUuid().then(resp => {
                                if (!resp.data || !resp.data.length) {
                                    $scope.isO2Patient = false;
                                    return null;
                                }
                                $scope.isO2Patient = true;
                                const uuid = resp.data[0].uuid;
                                return paymentStatusService.getPaymentStatus(uuid);
                            }).then(response => {
                                if (!response) return;

                                $scope.o2PaymentStatus = response.data;
                            }).catch(err => {
                                console.error("Payment status error:", err);
                                $scope.patient.paymentStatus = false;
                            });
                        }
                    });
                    $scope.initialization = initPromise;
                };

                var link = function ($scope, element) {
                    spinner.forPromise($scope.initialization, element);
                };

                return {
                    restrict: 'E',
                    controller: controller,
                    link: link,
                    scope: {
                        patientUuid: "@",
                        visitUuid: "@",
                        config: "=",
                        triageStatus: "=?",
                        paymentStatus: "=?"},
                    templateUrl: "../common/displaycontrols/patientprofile/views/patientProfile.html"
                };
            }]);
})();
