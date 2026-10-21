'use strict';

var isTime = function (propertyName) {
    return propertyName.toLowerCase().includes('time');
}

var sortByTime = function (arr){
    arr.sort((a, b) => {
        const dateA = new Date('01/01/2024 ' + a.toBeGiven);
        const dateB = new Date('01/01/2024 ' + b.toBeGiven);
        
        return dateA.getTime() - dateB.getTime();
      });
}

var parseDrugInfo = function (medicationDetails){
   
    var drugInfo = {time: []};

         _.forEach(medicationDetails,function(medicationDetail){
            var conceptName = medicationDetail.concept.display || medicationDetail.concept.name

             if(!isTime(conceptName))
                 drugInfo[conceptName] = medicationDetail.value;

            else if(isTime(conceptName)){
                var date  = new Date();
                    date = date.toString().slice(0, 16)
                var time = moment(date + medicationDetail.value).add(3,'h').format("hh:mm:ss A");

                 drugInfo.time.push({toBeGiven  :  medicationDetail.valueAsString ? time : new Date(medicationDetail.value).toLocaleTimeString(), 
                                     given      :  "",
                                     reason     :  "",
                                     givenLabel :  "Given",
                                     notGivenLabel:"Not Given",
                                     prevValues : []})
                 }
         })
        return drugInfo;   
    }

Bahmni.ConceptSet.MedicationViewModel = {

    create: function (medicationDetails) {

                    var medication = {display: "", time: []};
                    var drugInfo = parseDrugInfo(medicationDetails)
                    sortByTime(drugInfo.time);
                    medication.display = drugInfo["New Drug Name"] + ", " + drugInfo["Drug dose"] + ", " + drugInfo["Drug Route"] + ", " + drugInfo["Drug Frequency"]
                    medication.status = ["hold", "discontinue", "escalate", "de-escalate"]
                    medication.time = drugInfo.time;
                    medication.datesOfObs = [];
                    return medication;
            }
    
};
