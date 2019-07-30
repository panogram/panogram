import { ViewerPedigree } from "./src/viewerPedigree";
import { clone } from "ramda";

window.jQuery = jquery;
window.jquery = jquery;

const render = ({ data }) => {
    jquery("doc").ready(() => {
        new ViewerPedigree({
            type: "simpleJSON",
            data,
        });
    });
};

const getPedigreeData = patientId => jquery.ajax({
    url: `/patient/${patientId}/pedigree.json`,
    method: "GET",
});

const getSegData = (patientId, patientSnvId, transcriptId, geneName) => jquery.ajax({
    url: `/${patientId}/snv/${patientSnvId}/transcript/${transcriptId}/gene/${geneName}/pedigree/segregation.json`,
    method: "GET",
});

const getDataAndRender = (patientId, type) => {
    let promise;
    if (type === 'segregation') {
        const transcriptId = jquery('#transcriptId').val();
        const patientSnvId = jquery('#patientSnvId').val();
        const geneName = jquery('#geneName').val();
        promise = getSegData(patientId, patientSnvId, transcriptId, geneName);
    } else {
        promise = getPedigreeData(patientId);
    }
    
    promise.then(data => {
      console.log(data);
      render({
        data,
      })
    })
    .catch(err => {
        if (err.status === 403) {
            jquery('body').append('<p>please <a href="http://localhost:8000">log in</a></p>');
        }
        console.trace(err);
    });
};

const createInput = () => {
    jquery('body').prepend('<span>Patient ID: </span><input type="number" name="patientId" id="patientId" value="525"></input><button id="go">go</button> <a href="" id="525">525</a>, <a href="" id="9971">9971</a>, <a href="" id="4247">4247</a>');
    jquery('body').prepend('<span>Patient SNV ID: </span><input type="number" name="patientSnvId" id="patientSnvId" value="2919479"></input>');
    jquery('body').prepend('<span>Transcript ID: </span><input type="number" name="transcriptId" id="transcriptId" value="26989"></input>');
    jquery('body').prepend('<span>Gene name: </span><input type="text" name="geneName" id="geneName" value="ATM"></input>');
    jquery('body').prepend('<select id="type"><option value="segregation">Segregation</option><option value="overview">Overview</option></select>');
    jquery('#go').on('click', e => {
        e.preventDefault();
        const type = jquery('#type').val();
        const patientId = jquery('#patientId').val().strip();
        getDataAndRender(patientId, type);
    });
    jquery('#9971').on('click', e => {
        const type = jquery('#type').val();
        e.preventDefault();
        getDataAndRender(9971, type);
    });
    jquery('#525').on('click', e => {
        const type = jquery('#type').val();
        e.preventDefault();
        getDataAndRender(525, type);
    });
    jquery('#4247').on('click', e => {
        const type = jquery('#type').val();
        e.preventDefault();
        getDataAndRender(4247, type);
    });
};

jquery(document).ready(() => {
    const patientId = jQuery('#panogram').data('patient-id');
    const development = jQuery('#panogram').data('env') === 'dev';

    if (development) {
        createInput();
        getDataAndRender(patientId, 'segregation');
    }

    if (window.parent.PEDIGREE_DATA) {
        const data = clone(window.parent.PEDIGREE_DATA);
        // globals are bad pretend this never happened
        delete window.parent.PEDIGREE_DATA;
        render({ data });
    }
    else {
        getDataAndRender(patientId);
    }
});
