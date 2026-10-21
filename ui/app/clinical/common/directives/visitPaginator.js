'use strict';

angular.module('bahmni.clinical')
    .directive('visitPaginator', ['$rootScope','$location','$state', '$http', '$stateParams', 'visitService', function ($rootScope, $location, $state, $http, $stateParams, visitService) {
        var link = function ($scope) {
            var visits = _.clone($scope.visits).reverse();

            var visitIndex = _.findIndex(visits, function (visitHistoryEntry) {
                return $scope.currentVisitUuid !== null && visitHistoryEntry.uuid === $scope.currentVisitUuid;
            });

            $scope.fromMedico = false;
            $scope.visitHistoryEntry = visits[visitIndex];
            if($location.url().includes("from=fromMedico")) {
                $rootScope.fromMedico = true;
                $scope.fromMedico = true;
            }

            $scope.getUserIsMedico = function() {
                return $scope.$root.currentUser.privileges.find(priv => priv.name === 'app:medicoLegal') != null;
            }
            $scope.userIsMedico = $scope.getUserIsMedico();
            
            $scope.shouldBeShown = function () {
                return $state.is('patient.dashboard.visit');
            };

            $scope.hasNext = function () {
                return visitIndex !== -1 && visitIndex < (visits.length - 1);
            };

            document.addEventListener('DOMContentLoaded', function() {
                var medicoLegalCheckbox = document.getElementById("medico-legal-checkbox");
                if (medicoLegalCheckbox) {
                    var isChecked = medicoLegalCheckbox.checked;
                
                    medicoLegalCheckbox.addEventListener('click', function() {
                        isChecked = medicoLegalCheckbox.checked;
                        console.log('Checkbox state changed: ' + isChecked);
                        updateMedicoLegalAttribute(isChecked);
                    });
                } else {
                    console.log('Checkbox does not exist');
                }
            });
            if ($scope.visitHistoryEntry.visitType.uuid != $scope.visits[0].visitType.uuid){
                var visitType = $scope.visitHistoryEntry.visitType.uuid;
            }
            $scope.updateMedicoLegalAttribute = function(isChecked) {
                var personUuid = $stateParams.patientUuid;
                var attributeUuid = "3e2ac9e1-6e04-444c-9126-ccb2131a8c04";
                var attributeValue = isChecked ? "true" : "false";
                if(attributeValue) {
                    var attributeDetails = {
                        "attributes": [{
                           "attributeType": attributeUuid,
                           "value": attributeValue
                         }]
                       };
                       $http.post('/openmrs/ws/rest/v1/person/' + personUuid, attributeDetails, {
                         withCredentials: true
                       });
                       var medicoLegalVisitDetails = {
                        patient: personUuid,
                        visitType: $scope.visitHistoryEntry.visitType.uuid,
                        startDatetime: $scope.visitHistoryEntry.startDatetime,
                        stopDatetime: $scope.visitHistoryEntry.stopDatetime
                    };
                    return visitService.createMedicoVisit(medicoLegalVisitDetails);
                }
            };

            $scope.hasPrevious = function () {
                return visitIndex > 0;
            };

            $scope.next = function () {
                if ($scope.hasNext() && $scope.nextFn) {
                    $scope.nextFn()(visits[visitIndex + 1].uuid);
                }
            };

            $scope.previous = function () {
                if ($scope.hasPrevious() && $scope.previousFn) {
                    $scope.previousFn()(visits[visitIndex - 1].uuid);
                }
            };
        };

        return {
            restrict: 'EA',
            scope: {
                currentVisitUuid: "=",
                visits: "=",
                nextFn: "&",
                previousFn: "&",
                visitSummary: "="
            },
            link: link,
            templateUrl: 'common/views/visitPagination.html'
        };
    }])
;
