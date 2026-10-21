'use strict';

angular.module('bahmni.clinical')
    .service('visitFormService', ['$http', function ($http) {
        var formData = function (patientUuid, numberOfVisits, formGroup, patientProgramUuid, v) {
            var params = {
                s: "byPatientUuid",
                patient: patientUuid,
                numberOfVisits: numberOfVisits,
                v: v || "visitFormDetails",
                conceptNames: formGroup || null,
                patientProgramUuid: patientProgramUuid || null
            };
            return $http.get(Bahmni.Common.Constants.formDataUrl, {params: params});
        };

        return {
            formData: formData
        };
    }]);
