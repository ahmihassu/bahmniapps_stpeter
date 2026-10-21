'use strict';

angular.module('bahmni.clinical')
    .directive('visitsTable', ['patientVisitHistoryService', 'conceptSetService', 'spinner', '$state', '$q', '$translate',
        function (patientVisitHistoryService, conceptSetService, spinner, $state, $q, $translate) {
            var controller = function ($scope) {
                var emitNoDataPresentEvent = function () {
                    $scope.$emit("no-data-present-event");
                };
                $scope.openVisit = function (visit) {
                    if ($scope.$parent.closeThisDialog) {
                        $scope.$parent.closeThisDialog("closing modal");
                    }
                    $state.go('patient.dashboard.visit', {visitUuid: visit.uuid});
                };

                $scope.hasVisits = function () {
                    return $scope.visits && $scope.visits.length > 0;
                };
                $scope.translateVisitTypes = function (attribute) {
                    var translatedName = Bahmni.Common.Util.TranslationUtil.translateAttribute(attribute, Bahmni.Common.Constants.visit, $translate);
                    attribute = translatedName;
                    return attribute;
                };
                $scope.params = angular.extend(
                    {
                        maximumNoOfVisits: 4,
                        title: "Visits"
                    }, $scope.params);

                $scope.noVisitsMessage = "No Visits for this patient.";

                $scope.toggle = function (visit) {
                    visit.isOpen = !visit.isOpen;
                    visit.cacheOpenedHtml = true;
                };

                $scope.filteredObservations = function (observation, observationTemplates) {
                    var observationTemplateArray = [];
                    for (var observationTemplateIndex in observationTemplates) {
                        observationTemplateArray.push(observationTemplates[observationTemplateIndex].display);
                    }

                    var obsArrayFiltered = [];
                    for (var ob in observation) {
                        if (_.includes(observationTemplateArray, observation[ob].concept.display)) {
                            obsArrayFiltered.push(observation[ob]);
                        }
                    }
                    return obsArrayFiltered;
                };

                $scope.editConsultation = function (encounter) {
                    showNotApplicablePopup();
                    if ($scope.$parent.closeThisDialog) {
                        $scope.$parent.closeThisDialog("closing modal");
                    }
                    $state.go('patient.dashboard.show.observations', {
                        conceptSetGroupName: "observations",
                        encounterUuid: encounter.uuid
                    });
                };

                $scope.getDisplayName = function (data) {
                    var concept = data.concept;
                    var displayName = data.concept.displayString;
                    if (concept.names && concept.names.length === 1 && concept.names[0].name !== "") {
                        displayName = concept.names[0].name;
                    } else if (concept.names && concept.names.length === 2) {
                        displayName = _.find(concept.names, {conceptNameType: "SHORT"}).name;
                    }
                    return displayName;
                };

                $scope.getProviderDisplayName = function (encounter) {
                    return encounter.encounterProviders.length > 0 ? encounter.encounterProviders[0].provider.display : null;
                };

                $scope.getUserIsMedico = function() {
                    return $scope.$root.currentUser.privileges.find(priv => priv.name === 'app:medicoLegal') != null;
                }

                var getVisits = function () {
                    return patientVisitHistoryService.getVisitHistory($scope.patientUuid);
                };

                var init = function () {
                    return $q.all([getVisits()]).then(function (results) {
                        $scope.visits = results[0].visits;
                        $scope.hasMatchingVisitType = function(visit) {
                            var medicoLegalVisits = [];
                            for (var i = 0; i < $scope.visits.length; i++) {
                                var visitt = $scope.visits[i];
                                var medicoLegalVisit = visitt?.attributes?.find(attr => attr.display === 'Medico Legal Cases: true');
                                if (medicoLegalVisit != null) {
                                    medicoLegalVisits.push(visitt);
                                }
                            }
                            for (var j = 0; j < medicoLegalVisits.length; j++) {
                                var medicoVisit = medicoLegalVisits[j];
                                
                                if (!visit.isMedico() && visit.getVisitType() === medicoVisit.getVisitType() && 
                                (moment(visit.startDatetime).isSame(medicoVisit.startDatetime, 'day') && moment(visit.stopDatetime).isSame(medicoVisit.stopDatetime, 'day'))) {
                                    return true;
                                }                            
                            }
                            return false; 
                        };
                        $scope.userIsMedico = $scope.getUserIsMedico(); 
                        $scope.patient = {uuid: $scope.patientUuid};
                        if (!$scope.hasVisits()) emitNoDataPresentEvent();
                    });
                };

                $scope.initialization = init();

                $scope.params = angular.extend(
                    {
                        maximumNoOfVisits: 4,
                        title: "Visits"
                    }, $scope.params);

                $scope.noVisitsMessage = "No Visits for this patient.";
            };
            var link = function ($scope, element) {
                spinner.forPromise($scope.initialization, element);
            };

            return {
                restrict: 'E',
                link: link,
                controller: controller,
                templateUrl: "displaycontrols/allvisits/views/visitsTable.html",
                scope: {
                    params: "=",
                    patientUuid: "="
                }
            };
        }]);
