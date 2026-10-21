'use strict';

angular.module('bahmni.common.domain')
    .service('visitService', ['$http', '$q', function ($http, $q) {
        this.getVisit = function (uuid, params) {
            var parameters = params ? params : "custom:(uuid,visitId,visitType,patient,encounters:(uuid,encounterType,voided,orders:(uuid,orderType,voided,concept:(uuid,set,name),),obs:(uuid,value,concept,obsDatetime,groupMembers:(uuid,concept:(uuid,name),obsDatetime,value:(uuid,name),groupMembers:(uuid,concept:(uuid,name),value:(uuid,name),groupMembers:(uuid,concept:(uuid,name),value:(uuid,name)))))))";
            return $http.get(Bahmni.Common.Constants.visitUrl + '/' + uuid,
                {
                    params: {
                        v: parameters
                    }
                }
            );
        };
        this.updateLocation = function(visitUuid, attributes){
            return $http.post(Bahmni.Common.Constants.visitUrl + '/' + visitUuid + '/attribute/' +  attributes.attributes[0].attributeType, {
                    value: attributes.attributes[0].value
            });
        }
        this.endVisit = function (visitUuid) {
            return $http.post(Bahmni.Common.Constants.endVisitUrl + '?visitUuid=' + visitUuid, {
                withCredentials: true
            });
        };

        this.endVisitAndCreateEncounter = function (visitUuid, bahmniEncounterTransaction) {
            return $http.post(Bahmni.Common.Constants.endVisitAndCreateEncounterUrl + '?visitUuid=' + visitUuid, bahmniEncounterTransaction, {
                withCredentials: true
            });
        };

        this.setMedicoLegalAttributeOnVisit = function (visitUuid) {
            return getMedicoLegalUuid().then(function (r) {
                if (!r.data || !r.data.length || !r.data[0].uuid) {
                    return $q.reject({ data: { message: 'getMedicoLegalUuid SQL returned no row. Check bahmni.sqlGet.getMedicoLegalUuid.' } });
                }
                var medicoLegalAttributeTypeUuid = r.data[0].uuid;
                return $http.post(
                    Bahmni.Common.Constants.visitUrl + '/' + visitUuid + '/attribute',
                    {
                        attributeType: medicoLegalAttributeTypeUuid,
                        value: true
                    },
                    { withCredentials: true }
                );
            });
        };

        this.updateVisit = function (visitUuid, attributes) {
            return $http.post(Bahmni.Common.Constants.visitUrl + '/' + visitUuid, attributes, {
                withCredentials: true
            });
        };

        var getisEmergencyUuid = function () {
            var params = {
                q: "bahmni.sqlGet.isEmergencyUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };   

        this.createEmergencyVisit = function (visitDetails) {
            getisEmergencyUuid().then(function(r){
                visitDetails["attributes"]=[{value :true, attributeType:r.data[0].uuid}]
            })
            return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                withCredentials: true
            });
        };


        var getMedicoLegalUuid = function () {
            var params = {
                q: "bahmni.sqlGet.getMedicoLegalUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };   

        this.createMedicoVisit = function (visitDetails) {
            return getMedicoLegalUuid().then(function(r){
                visitDetails["attributes"]=[{value :true, attributeType:r.data[0].uuid}]
                return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                    withCredentials: true
                });
            })
            
        };


        this.createEmergencyMedicoVisit = function(visitDetails) {
            return $q.all([
                getisEmergencyUuid(),
                getMedicoLegalUuid()
            ]).then(function (responses) {
                var isEmergencyUuid = responses[0].data[0].uuid;
                var medicoLegalUuid = responses[1].data[0].uuid;

                var existing = visitDetails.attributes ? visitDetails.attributes.slice() : [];
                visitDetails.attributes = existing.concat([
                    { value: true, attributeType: isEmergencyUuid },
                    { value: true, attributeType: medicoLegalUuid }
                ]);
            return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                withCredentials: true
            });   
            });
        };

        this.createVisit = function (visitDetails) {
            return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                withCredentials: true
            });
        };

        this.getVisitSummary = function (visitUuid) {
            return $http.get(Bahmni.Common.Constants.visitSummaryUrl,
                {
                    params: {
                        visitUuid: visitUuid
                    },
                    withCredentials: true
                }
            );
        };

        this.search = function (parameters) {
            return $http.get(Bahmni.Common.Constants.visitUrl, {
                params: parameters,
                withCredentials: true
            });
        };

        this.getVisitType = function () {
            return $http.get(Bahmni.Common.Constants.visitTypeUrl, {
                withCredentials: true
            });
        };
        this.getConsultationStatus = function (visitUuid){
            var params = {
                q: "get_consultation_status",
                uuid: visitUuid
            };
            return $http.get(Bahmni.Common.Constants.sqlUrl, {
                method: "GET",
                params: params,
                withCredentials: true
            });
        }
    }]);
