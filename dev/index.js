import Frappe from '../js/frappe.js';

let frappe = new Frappe(document.body);
    
// for demo
window.$f = frappe;

const startDemo = () => {
    // just 4 test
    frappe.add('start', 100, 100), frappe.add('end', 100, 800), frappe.add('kill', 500, 300);
};

startDemo();

window.addEventListener('frappe.edit', e => alert(e.detail.uuid));