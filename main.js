import { ViewerPedigree } from "./src/viewerPedigree";

window.jQuery = jquery;
window.jquery = jquery;

const render = ({ data, probandDataUrl, pedigreeDataUrl }) => {
    jquery("doc").ready(() => {
        new ViewerPedigree({
            type: "simpleJSON",
            data,
            probandDataUrl, // TODO replace loading of this with webpak module
            pedigreeDataUrl,
        });
    });
};

console.log(1);

const getPedigreeData = patientId => jquery.ajax({
    url: `/patient/${patientId}/pedigree.json`,
    method: "GET",
});

const getDataAndRender = patientId => {
    getPedigreeData(patientId)
    .then(data => render({
        data,
        probandDataUrl,
        pedigreeDataUrl,
    }))
    .catch(err => {
        if (err.status === 403) {
            jquery('body').append('<p>please <a href="http://localhost:8000">log in</a></p>');
        }
        console.trace(err);
    });
};

const createInput = () => {
    jquery(document).ready(() => {
        jquery('body').prepend('<span>Patient ID: </span><input type="number" name="patientId" id="patientId"></input><button id="go">go</button> <a href="" id="525">525</a>, <a href="" id="9971">9971</a>, <a href="" id="4247">4247</a>');
        jquery('#go').on('click', e => {
            e.preventDefault();
            const patientId = jquery('#patientId').val().strip();
            getDataAndRender(patientId);
        });
        jquery('#9971').on('click', e => {
            e.preventDefault();
            getDataAndRender(9971);
        });
        jquery('#525').on('click', e => {
            e.preventDefault();
            getDataAndRender(525);
        });
        jquery('#4247').on('click', e => {
            e.preventDefault();
            getDataAndRender(4247);
        });
    });
};

const prefix = "/js/ext-lib/panogram";
const probandDataUrl = "/public/xwiki/PhenoTips.PatientClass/0.xml";
const pedigreeDataUrl = "/public/xwiki/PhenoTips.PedigreeClass/0.xml";

// get the data and draw the stuff
if (window.pedigreeData) {
    render({
        data: window.pedigreeData,
        probandDataUrl: prefix + probandDataUrl,
        pedigreeDataUrl: prefix + pedigreeDataUrl,
    });
} else {
    // this is dev mode
    const patientId = 525;
    createInput();
    getDataAndRender(patientId);
}
