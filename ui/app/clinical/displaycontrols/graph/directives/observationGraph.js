"use strict";

angular.module('bahmni.clinical').directive('observationGraph', ['appService', 'observationsService', 'patientService', 'conceptSetService', '$q', 'spinner', '$translate',
    function (appService, observationsService, patientService, conceptSetService, $q, spinner, $translate) {
        var generateGraph = function ($scope, element, config, observationGraphModel) {
            var bindToElement = document.getElementById($scope.graphId);
            var graphWidth = $(element).parent().width();
            var chart = Bahmni.Graph.c3Chart.create();
            chart.render(bindToElement, graphWidth, config, observationGraphModel);
        };

        var link = function ($scope, element) {
            $scope.graphId = 'graph' + $scope.$id;

            if (!$scope.params) {
                return;
            }

            var config = new Bahmni.Clinical.ObservationGraphConfig($scope.params.config);

            config.validate($scope.params.title);

            var promises = [];
            var patientResultIndex = -1;
            var referenceDataResultIndex = -1;

            var numberOfLevels = 1;
            var fields = ['uuid', 'name', 'names', 'hiNormal', 'lowNormal', 'units', 'datatype'];
            var customRepresentation = Bahmni.ConceptSet.CustomRepresentationBuilder.build(fields, 'setMembers', numberOfLevels);
            var conceptValue = conceptSetService.getConcept({
                name: config.getAllConcepts(),
                v: "custom:" + customRepresentation
            });
            promises.push(conceptValue);

            var observationsPromise = observationsService.fetch($scope.patientUuid, config.getAllConcepts(), null, config.numberOfVisits, $scope.visitUuid, null, false);
            promises.push(observationsPromise);

            if (config.displayForAge() || config.shouldDrawReferenceLines()) {
                patientResultIndex = promises.length;
                promises.push(patientService.getPatient($scope.patientUuid));
            }

            if (config.shouldDrawReferenceLines()) {
                referenceDataResultIndex = promises.length;
                promises.push(appService.loadCsvFileFromConfig(config.getReferenceDataFileName()));
            }

            var getConceptName = function (conceptResult) {
                if (!conceptResult || !conceptResult.name) {
                    return undefined;
                }
                if (typeof conceptResult.name === "string") {
                    return conceptResult.name;
                }
                return conceptResult.name.name;
            };

            var checkWhetherYAxisIsNumericDataType = function (yAxisConceptDetails) {
                if (yAxisConceptDetails.datatype.name !== "Numeric") {
                    var errorMsg = $translate.instant(Bahmni.Clinical.Constants.errorMessages.conceptNotNumeric)
                        .replace(":conceptName", getConceptName(yAxisConceptDetails))
                        .replace(":placeErrorAccurred", $scope.params.title + " config in growthChartReference.csv");
                    throw new Error(errorMsg);
                }
            };
            spinner.forPromise($q.all(promises).then(function (results) {
                var conceptApiData = results[0].data;
                var conceptResults = conceptApiData && conceptApiData.results ? conceptApiData.results : [];
                var yAxisConceptDetails = _.find(conceptResults, function (conceptResult) {
                    var conceptName = getConceptName(conceptResult);
                    return conceptName && _.some(config.yAxisConcepts, function (yAxisConceptName) {
                        return yAxisConceptName && yAxisConceptName.toLowerCase() === conceptName.toLowerCase();
                    });
                });
                if (!yAxisConceptDetails && conceptResults.length) {
                    yAxisConceptDetails = conceptResults[0];
                }
                var conceptAliasMap = Bahmni.Clinical.ObservationGraph.buildConceptAliasMap(config, conceptApiData);
                var observations = results[1].data;
                var patient = patientResultIndex >= 0 ? results[patientResultIndex].data.person : undefined;
                var referenceLines;

                if (config.shouldDrawReferenceLines()) {
                    if (!yAxisConceptDetails) {
                        console.warn("Unable to resolve y-axis concept details", {
                            sectionTitle: $scope.params.title,
                            configuredYAxisConcepts: config.yAxisConcepts,
                            referenceData: config.getReferenceDataFileName()
                        });
                        return;
                    }
                    checkWhetherYAxisIsNumericDataType(yAxisConceptDetails);
                    var referenceData = results[referenceDataResultIndex].data;
                    var ageInMonths = patient && patient.birthdate ? Bahmni.Common.Util.AgeUtil.differenceInMonths(patient.birthdate) : undefined;
                    var yAxisUnit = yAxisConceptDetails.units;
                    var observationGraphReferenceModel = new Bahmni.Clinical.ObservationGraphReference(referenceData, config, patient && patient.gender, ageInMonths, yAxisUnit);
                    observationGraphReferenceModel.validate();
                    referenceLines = observationGraphReferenceModel.createObservationGraphReferenceLines();
                }
                if (observations.length === 0) {
                    $scope.$emit("no-data-present-event");
                    return;
                }

                if (yAxisConceptDetails !== undefined) {
                    config.lowNormal = yAxisConceptDetails.lowNormal;
                    config.hiNormal = yAxisConceptDetails.hiNormal;
                }
                var model = Bahmni.Clinical.ObservationGraph.create(observations, patient, config, referenceLines, conceptAliasMap);
                generateGraph($scope, element, config, model);
            }), element);
        };

        return {
            restrict: 'E',
            templateUrl: "displaycontrols/graph/views/observationGraph.html",
            scope: {
                params: "=",
                visitUuid: "=",
                patientUuid: "="
            },
            link: link
        };
    }]);
