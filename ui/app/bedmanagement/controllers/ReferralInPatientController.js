"use strict";

angular.module('ipd')
    .controller('ReferralInPatientController', ['$scope', '$rootScope', '$state',
        'sessionService', 'messagingService', '$stateParams', '$http', 'printer', '$bahmniCookieStore',
        function ($scope, $rootScope, $state, sessionService, messagingService,
                  $stateParams, $http, printer, $bahmniCookieStore) {

            $scope.patientUuid = $stateParams.patientUuid;
            
            // Get the location object from the cookie directly
            var cookieLocation = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
            $scope.locationName = cookieLocation ? cookieLocation.name : "Kidus Petros Hospital";

            $scope.referral = {};

            // --- Fetch existing referral data ---
            var fetchReferralData = function () {
                var params = {
                    q: 'bahmni.sqlGet.patientsReferralInData',
                    // Using dynamic patientUuid from the URL
                    patientUuid: $scope.patientUuid, 
                    v: 'full'
                };

                return $http.get(Bahmni.Common.Constants.sqlUrl, {
                    params: params,
                    withCredentials: true
                }).then(function (response) {
                    if (response.data && response.data.length > 0) {
                        const data = response.data[0];
                        
                        $scope.referral = {
                            patientDiagnosis: data.patientDiagnosis,
                            fromLocation: data.fromLocation,
                            referralReason: data.referralReason,
                            timeOfCommunication: data.timeOfCommunication,
                            timeOfArrival: data.timeOfArrival,
                            referringPhysician: data.referringPhysician,
                            referralFromOther: data.referralFromOther,
                            referringHP: data.referringHP, 
                            receivingLO: data.receivingLO,
                            commentingHP: data.commentingHP,
                            triageCommunication: data.triageCommunication,
                            modeOfArrival: data.modeOfArrival,
                            referringFacility: data.referringFacility,
                            liaisonTelephone: data.liaisonTelephone,
                            diagnosisSame: data.diagnosisSame,
                            conditionOnArrival: data.conditionOnArrival,
                            referralNecessary: data.referralNecessary,
                            referralComplete: data.referralComplete
                        };
                    } else {
                        $scope.referral = {};
                    }
                }).catch(function (error) {
                    messagingService.showMessage('error', 'Failed to fetch referral data');
                    $scope.referral = {};
                });
            };

            $scope.printOptions = [
                {
                    name: 'referralSummary',
                    label: 'Print Referral Summary',
                    templateUrl: '../bedmanagement/views/prints/referral-summary.html',
                    shortcutKey: 'p'
                }
            ];

            $scope.defaultPrintOption = $scope.printOptions[0];

            $scope.buttonText = function(option, type) {
                var printHtml = type ? '<i class="fa fa-print"></i>' : '';
                return '<span>' + option.label + '</span>' + printHtml;
            };

            // --- Print function with Location Name fix ---
            $scope.printReferral = function(option) {
                var printData = {
                    patient: $scope.patient,
                    referral: $scope.referral,
                    today: new Date(),
                    locationName: $scope.locationName, // Now safe!
                    provider: $rootScope.currentUser ? $rootScope.currentUser.username : 'Super Man'
                };
                printer.print(option.templateUrl, printData);
            };

            var init = function () {
                fetchReferralData();
            };

            init();
        }]);