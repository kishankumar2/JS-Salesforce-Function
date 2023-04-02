/**
 * Describe Exceljsexample here.
 *
 * The exported method is the entry point for your code when the function is invoked.
 *
 * Following parameters are pre-configured and provided to your function on execution:
 * @param event: represents the data associated with the occurrence of an event, and
 *                 supporting metadata about the source of that occurrence.
 * @param context: represents the connection to Functions and your Salesforce org.
 * @param logger: logging handler used to capture application logs and trace specifically
 *                 to a given execution of a function.
 */
import  Excel  from "exceljs";
import fs from "fs";

export default async function (event, context, logger) {
  logger.info("Invoking Exceljs Function");
  
  // Query Salesforce to get Account, Contact and Opportunity Records
  var results = await context.org.dataApi.query('SELECT Id, Name,AnnualRevenue , Industry, (SELECT Id,Name,Phone FROM Contacts),(Select ID ,Name, StageName,Amount , Probability,CloseDate from Opportunities ) FROM Account');
  //Creating the Instance of Excel Workbook                                       
  const wb = new Excel.Workbook();
  // Adding a new WorkSheet in the work Book Name of the Sheet is Accounts
  const AccountSheet = wb.addWorksheet('Accounts', {properties:{tabColor:{argb:'264653'}}});
  AccountSheet.addRows([['ID','Account Name','AnnualRevenue','Industry']]);
  // Adding a new WorkSheet in the work Book Name of the Sheet is Contacts
  const ContactSheet = wb.addWorksheet('Contacts',{properties:{tabColor:{argb:'e76f51'}}});
  ContactSheet.addRows([['ID','Contact Name','Phone Number','Account ID']]);
  // Adding a new WorkSheet in the work Book Name of the Sheet is Opportunities
  const OppSheet = wb.addWorksheet('Opportunities',{properties:{tabColor:{argb:'2a9d8f'}}});
 
  //this Array will hold Opportunity Rows to be added in the Table
  var oppRows = [];
 
  logger.info('Parsing Starts');
  try {  
  let recordsToProcess = results.records;
  while (recordsToProcess.length > 0) {
    logger.info('Processing Batch with Size '+recordsToProcess.length);
    recordsToProcess.forEach(function(item){
      AccountSheet.addRows([[item.fields.id,item.fields.name,item.fields.annualRevenue,item.fields.industry]]);
      if(!isEmpty(item.subQueryResults) ){
        item.subQueryResults.contacts.records.forEach(function(cont){
          ContactSheet.addRows([[cont.fields.Id,cont.fields.name,cont.fields.phone,item.fields.id]]);
        })
        item.subQueryResults.opportunities.records.forEach(function(oppt){
          oppRows.push([oppt.fields.Id,oppt.fields.name,oppt.fields.stageName,oppt.fields.probability,oppt.fields.closeDate,oppt.fields.amount]);
        
        })
        
        
      }
    });

    results = await context.org.dataApi.queryMore(results);
    recordsToProcess=results.records;

  }

  logger.info('Parsing Ends',oppRows.length);
  //Adding a Table in Opportunity Worksheet
  OppSheet.addTable({
    name: 'MyTable',
    ref: 'A1',
    headerRow: true,
    totalsRow: true,
    style: {
      theme: 'TableStyleDark1',
      showRowStripes: true,
    },
    columns: [
      {name: 'ID',  filterButton: true},
      {name: 'Opportunity Name', filterButton: true},
      {name: 'stageName', filterButton: true},
      {name: 'probability', filterButton: false},
      {name: 'closeDate', filterButton: true},
      {name: 'Amount', totalsRowFunction: 'sum', filterButton: false},
    ],
    rows: oppRows,
  });
  //Formatting cells of Account Sheet  
  AccountSheet.columns.forEach(column => {
    column.border = {
      top: { style: "thick" },
      left: { style: "thick" },
      bottom: { style: "thick" },
      right: { style: "thick" }
    };
  });
   //Formatting cells of Opportunity Sheet
  OppSheet.columns.forEach(column => {
    column.border = {
      top: { style: "thick" },
      left: { style: "thick" },
      bottom: { style: "thick" },
      right: { style: "thick" }
    };
  });
 // Writing the Excel to a File
  const fileName = './assets/simple.xlsx';
  await wb.xlsx.writeFile(fileName)
    .then(() => {
            logger.info('file created');
          })
    .catch(err => {
      logger.info(err.message);
    });
  

  // Reading the Excel Data in Base64 to be uploaded in Salesforce
  var dataa =fs.readFileSync(fileName,'base64');
  logger.info('dataa'+dataa);
//Creating a ContentVersion Salesforce Record with the Base64 Data
const contentVersion = {
  type: "ContentVersion",
  fields: {
    VersionData: dataa,
    Title: 'ExcelFromFunction',
    origin: "H",
    PathOnClient: 'FunctionExcel.xlsx',
  },
};

// Insert ContentVersion record and return the Id
const { id: contentVersionId } = await context.org.dataApi.create(
  contentVersion
);

// Query ContentVersion record results with the field ContentDocumentId
const { records: contentVersions } = await context.org.dataApi.query(
  `SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id ='${contentVersionId}'`
);

const contentDocumentId = contentVersions[0].fields.contentdocumentid;

// Set a new ContentDocumentLink for Creation
const contentDocumentLink = {
  type: "ContentDocumentLink",
  fields: {
    ContentDocumentId: contentDocumentId,
    LinkedEntityId: "0012w00001SMM8eAAH",
    ShareType: "V",
    Visibility: "AllUsers",
  },
};

// Insert ContentDocumentLink record to attach the PDF document into the user record
const { id: contentDocumentLinkId } = await context.org.dataApi.create(
  contentDocumentLink
);
} catch (err) {
const errorMessage = `Failed to . Root Cause : ${err.message}`;
logger.error(errorMessage);
}

logger.info('readFile called');

 // return dataToreturn;
}

function isEmpty(obj) {
return Object.keys(obj).length === 0;
}
