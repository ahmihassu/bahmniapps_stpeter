'use strict';

(function () {
    Bahmni = Bahmni || {};
    Bahmni.Clinical = Bahmni.Clinical || {};
    Bahmni.Clinical.ObservationGraph = function (model) {
        angular.extend(this, model);
    };

    var MS_PER_DAY = 24 * 60 * 60 * 1000;

    Bahmni.Clinical.ObservationGraph.buildConceptAliasMap = function (config, conceptApiResults) {
        var configuredConceptNames = _.uniq(_.compact(_.flatten([
            config.yAxisConcepts.slice(0),
            config.xAxisConcept
        ])));
        var aliasMap = {};
        _.each(configuredConceptNames, function (configuredName) {
            aliasMap[configuredName.toLowerCase()] = configuredName;
        });

        var conceptResults = (conceptApiResults && conceptApiResults.results) || [];
        _.each(conceptResults, function (conceptResult) {
            var conceptNames = [];
            if (conceptResult.name) {
                if (typeof conceptResult.name === "string") {
                    conceptNames.push(conceptResult.name);
                } else if (conceptResult.name.name) {
                    conceptNames.push(conceptResult.name.name);
                }
            }
            _.each(conceptResult.names || [], function (nameResult) {
                if (nameResult && nameResult.name) {
                    conceptNames.push(nameResult.name);
                }
            });

            var configuredMatch = _.find(configuredConceptNames, function (configuredName) {
                return _.some(conceptNames, function (conceptName) {
                    return conceptName && configuredName.toLowerCase() === conceptName.toLowerCase();
                });
            });

            if (configuredMatch) {
                _.each(conceptNames, function (conceptName) {
                    if (conceptName) {
                        aliasMap[conceptName.toLowerCase()] = configuredMatch;
                    }
                });
            }
        });

        return aliasMap;
    };

    var fixCaseMismatchIssues = function (config, observations, conceptAliasMap) {
        var conceptNamesFromConfig = _.uniq(_.compact(_.flatten([
            config.yAxisConcepts.slice(0),
            config.xAxisConcept
        ])));
        _.each(observations, function (obs) {
            var rawConceptNames = _.compact([
                obs.concept && obs.concept.name,
                obs.concept && obs.concept.shortName,
                obs.conceptNameToDisplay
            ]);
            var mappedConceptName;

            _.each(rawConceptNames, function (rawConceptName) {
                if (!mappedConceptName && rawConceptName && conceptAliasMap) {
                    mappedConceptName = conceptAliasMap[rawConceptName.toLowerCase()];
                }
            });

            if (!mappedConceptName) {
                _.each(rawConceptNames, function (rawConceptName) {
                    if (!mappedConceptName && rawConceptName) {
                        mappedConceptName = _.find(conceptNamesFromConfig, function (configConceptName) {
                            return configConceptName.toLowerCase() === rawConceptName.toLowerCase();
                        });
                    }
                });
            }

            obs.concept.name = mappedConceptName;
        });
    };

    var findMatchingXObservation = function (yAxisObs, xAxisObservations) {
        var exactObservation = _.find(xAxisObservations, function (xObs) {
            return yAxisObs.observationDateTime === xObs.observationDateTime;
        });
        if (exactObservation) {
            return exactObservation;
        }

        if (yAxisObs.encounterUuid) {
            var encounterObservation = _.find(xAxisObservations, function (xObs) {
                return xObs.encounterUuid && xObs.encounterUuid === yAxisObs.encounterUuid;
            });
            if (encounterObservation) {
                return encounterObservation;
            }
        }

        var yAxisMoment = Bahmni.Common.Util.DateUtil.parseDatetime(yAxisObs.observationDateTime);
        if (!yAxisMoment) {
            return undefined;
        }
        var yAxisMillis = yAxisMoment.valueOf();
        var closestObservation;
        var closestDistance = Infinity;

        _.each(xAxisObservations, function (xObs) {
            var xAxisMoment = Bahmni.Common.Util.DateUtil.parseDatetime(xObs.observationDateTime);
            if (!xAxisMoment) {
                return;
            }
            var distance = Math.abs(xAxisMoment.valueOf() - yAxisMillis);
            if (distance < closestDistance && distance <= MS_PER_DAY) {
                closestDistance = distance;
                closestObservation = xObs;
            }
        });

        return closestObservation;
    };

    var createObservationPoint = function (config, obs, xAxisValues) {
        var observation = {};
        observation[config.xAxisConcept] = xAxisValues;
        observation[obs.concept.name] = obs.value;
        return observation;
    };

    var findMatchingLine = function (lines, obs) {
        return _(lines).find(function (line) {
            return line.name === obs.concept.name;
        });
    };

    Bahmni.Clinical.ObservationGraph.create = function (allObservations, person, config, referenceLines, conceptAliasMap) {
        fixCaseMismatchIssues(config, allObservations, conceptAliasMap);

        var yAxisObservations = _.filter(allObservations, function (obs) {
            return obs.concept.name && obs.concept.name !== config.xAxisConcept;
        });

        var xAxisObservations = _.filter(allObservations, function (obs) {
            return obs.concept.name === config.xAxisConcept;
        });

        var lines = _(yAxisObservations).uniqBy(function (item) {
            return item.concept.name + item.concept.units;
        }).map(function (item) {
            return new Bahmni.Clinical.ObservationGraphLine({
                name: item.concept.name,
                units: item.concept.units,
                values: []
            });
        }).value();

        _.forEach(yAxisObservations, function (yAxisObs) {
            var xValue;
            if (config.displayForObservationDateTime()) {
                config.type = "timeseries";
                xValue = Bahmni.Common.Util.DateUtil.parseDatetime(yAxisObs.observationDateTime).toDate();
            } else if (config.displayForAge()) {
                xValue = Bahmni.Common.Util.AgeUtil.differenceInMonths(person.birthdate, yAxisObs.observationDateTime);
            } else {
                config.type = "indexed";
                var matchingObservation = findMatchingXObservation(yAxisObs, xAxisObservations);
                xValue = matchingObservation ? matchingObservation.value : undefined;
            }

            if (xValue !== undefined) {
                var line = findMatchingLine(lines, yAxisObs);
                if (line) {
                    var observationPoint = createObservationPoint(config, yAxisObs, xValue);
                    line.addPoint(observationPoint);
                }
            }
        });

        if (referenceLines !== undefined) {
            lines = lines.concat(referenceLines);
            var referenceLinesYAxisConcepts = _.map(referenceLines, 'name');
            config.yAxisConcepts = config.yAxisConcepts.concat(referenceLinesYAxisConcepts);
        }

        return new Bahmni.Clinical.ObservationGraph(lines);
    };
})();

