'use strict';

Bahmni.Clinical.SpecimenMapper = function () {
    var walkObservationMembers = function (members, visitorFn) {
        if (!members || !members.length) {
            return;
        }
        _.forEach(members, function (member) {
            visitorFn(member);
            walkObservationMembers(member.groupMembers, visitorFn);
        });
    };

    var clearObservationHideFlags = function (observation) {
        walkObservationMembers(observation && observation.groupMembers, function (member) {
            member.hide = false;
        });
    };

    var prepareObservationsForSave = function (observations) {
        if (!observations || !observations.length) {
            return [];
        }
        return _.chain(observations).filter(Boolean).map(function (observation) {
            var preparedObservation = angular.extend({}, observation);
            preparedObservation.groupMembers = _.filter(observation.groupMembers || [], function (member) {
                return !member.hide;
            });
            walkObservationMembers(preparedObservation.groupMembers, function (member) {
                delete member.hide;
                member.groupMembers = member.groupMembers || [];
            });
            preparedObservation.groupMembers = preparedObservation.groupMembers || [];
            return preparedObservation;
        }).value();
    };

    var hasDisplayableMembers = function (observation) {
        return !!(observation && observation.groupMembers && observation.groupMembers.length);
    };

    var mergeRequestIntoSampleResult = function (specimen) {
        if (!hasDisplayableMembers(specimen.sampleRequest)) {
            return;
        }
        if (!hasDisplayableMembers(specimen.sampleResult)) {
            specimen.sampleResult = specimen.sampleRequest;
            return;
        }
        specimen.sampleResult = angular.extend({}, specimen.sampleResult, {
            groupMembers: (specimen.sampleRequest.groupMembers || []).concat(specimen.sampleResult.groupMembers || [])
        });
        clearObservationHideFlags(specimen.sampleResult);
    };

    this.mapObservationToSpecimen = function (observation, allSamples, conceptsConfig, dontSortByObsDateTime) {
        var specimen = new Bahmni.Clinical.Specimen(observation, allSamples);
        specimen.cancellationReason = specimen.cancellationReason || observation.cancellationReason || observation.comment || specimen.voidedReason;
        specimen.specimenId = specimen.identifier;
        specimen.specimenSource = specimen.type.shortName ? specimen.type.shortName : specimen.type.name;
        specimen.specimenCollectionDate = specimen.dateCollected;

        specimen.sampleResult = null;
        specimen.sampleRequest = null;

        if (specimen.report && specimen.report.results) {
            specimen.report.results = (specimen.report.results) instanceof Array ? specimen.report.results : [specimen.report.results];

            var resultObs = new Bahmni.Common.Obs.ObservationMapper().map(specimen.report.results, conceptsConfig, dontSortByObsDateTime);
            specimen.sampleResult = resultObs && resultObs.length > 0 ? resultObs[0] : resultObs;
            clearObservationHideFlags(specimen.sampleResult);
        }
        if (specimen.sample && specimen.sample.additionalAttributes) {
            specimen.sample.additionalAttributes = (specimen.sample.additionalAttributes) instanceof Array ? specimen.sample.additionalAttributes : [specimen.sample.additionalAttributes];
            var requestObs = new Bahmni.Common.Obs.ObservationMapper().map(specimen.sample.additionalAttributes, conceptsConfig, dontSortByObsDateTime);
            specimen.sampleRequest = requestObs && requestObs.length > 0 ? requestObs[0] : requestObs;
            clearObservationHideFlags(specimen.sampleRequest);
        }
        mergeRequestIntoSampleResult(specimen);
        clearObservationHideFlags(specimen.sampleResult);
        return specimen;
    };

    this.mapSpecimenToObservation = function (specimen) {
        var observation = {};
        observation.dateCollected = moment(specimen.dateCollected).format("YYYY-MM-DDTHH:mm:ss.SSSZ");
        observation.existingObs = specimen.existingObs;
        observation.identifier = specimen.identifier;
        observation.sample = {};
        observation.report = {};
        observation.type = specimen.type;
        observation.voided = specimen.voided;
        observation.typeFreeText = specimen.typeFreeText;
        observation.uuid = specimen.uuid;
        observation.orderCategory = specimen.orderCategory || null;
        observation.orderType = specimen.orderType || null;
        observation.pathologyTechnique = specimen.pathologyTechnique || null;
        observation.voidedReason = specimen.voidedReason;
        observation.cancelled = specimen.cancelled || false;
        observation.cancellationReason = specimen.cancellationReason || null;
        observation.comment = specimen.cancellationReason || null;

        var observationFilter = new Bahmni.Common.Domain.ObservationFilter();
        var additionalAttributes = Array.isArray(specimen.sample.additionalAttributes) ?
            specimen.sample.additionalAttributes :
            [specimen.sample.additionalAttributes];
        additionalAttributes = prepareObservationsForSave(additionalAttributes);
        observation.sample.additionalAttributes = observationFilter.filter(additionalAttributes)[0];

        var reportResults = [];
        if (specimen.report && specimen.report.results && specimen.report.results.length) {
            reportResults = Array.isArray(specimen.report.results) ? specimen.report.results : [specimen.report.results];
            reportResults = prepareObservationsForSave(reportResults);
            observation.report.results = observationFilter.filter(reportResults)[0];
        }
        return observation;
    };
};
