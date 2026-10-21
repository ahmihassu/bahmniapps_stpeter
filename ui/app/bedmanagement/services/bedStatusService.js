'use stric';

angular.module('bahmni.common.patient')
    .service('bedStatusService',['$http',function($http){
        this.doesQuotationExist = function(patientId) {            
            return $http.get(`/openmrs/ws/rest/v1/bahmnicore/bedStatusService?patientId=${patientId}`,{
                withCredintials:true
            });
        };
        this.getDepositAmount = function(patientId) {
            return $http.get(`/openmrs/ws/rest/v1/bahmnicore/depositStatusService?patientId=${patientId}`)
        }
    }]);