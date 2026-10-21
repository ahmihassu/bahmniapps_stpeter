'use strict';

Bahmni.Clinical.Appointment = (function () {
    var Appointment = function (appointmentDetails) {
        angular.extend(this, appointmentDetails);
    };

    Appointment.create = function (appointmentDetails) {
        var dateUtil = Bahmni.Common.Util.DateUtil;
        var getDateTime = function (appointmentDate, givenTime) {
            if (!appointmentDate && !givenTime) return appointmentDate;
            var formattedTime = moment(givenTime, ["hh:mm a"]).format("HH:mm");
            return dateUtil.parseServerDateToDate(dateUtil.getDateWithoutTime(appointmentDate) + ' ' + formattedTime);
        };

        var getAppointmentProviders = function (provider) {
            var providerList = [];
            if (provider && provider[0].uuid !== undefined) {
                providerList.push({
                    uuid: provider[0].uuid,
                    response: provider[0].response,
                    comments: provider[0].comments
                });
            }
            return providerList;
        };
        

        var appointment = new Appointment({
            uuid: appointmentDetails.uuid,
            patientUuid: appointmentDetails.patient.uuid,
            serviceUuid: appointmentDetails.service.uuid,
            serviceTypeUuid: appointmentDetails.serviceType && appointmentDetails.serviceType.uuid,
            startDateTime: getDateTime(appointmentDetails.date, appointmentDetails.startTime),
            endDateTime: getDateTime(appointmentDetails.date, appointmentDetails.endTime),
            providerUuid: appointmentDetails.provider && appointmentDetails.provider.uuid,
            providers: getAppointmentProviders(appointmentDetails.providers),
            locationUuid: appointmentDetails.location && appointmentDetails.location.uuid,
            appointmentKind: appointmentDetails.appointmentKind,
            comments: appointmentDetails.comments + ":" + appointmentDetails.pno
        });
        return appointment;
    };

    return Appointment;
})();

