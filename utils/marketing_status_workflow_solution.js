/**
 * SOLUTION: Set Marketing Contact Status via Workflows
 * 
 * The hs_marketable_status property is READ-ONLY and cannot be updated via API.
 * The only way to programmatically change marketing contact status is through workflows.
 * 
 * REQUIREMENTS:
 * 1. Create a workflow in HubSpot with "Set marketing contact status" action
 * 2. Use the Workflows API to enroll contacts in that workflow
 * 
 * STEPS TO IMPLEMENT:
 * 1. In HubSpot, go to Automation > Workflows
 * 2. Create contact-based workflow with enrollment trigger: "Manual enrollment only"
 * 3. Add action: "Set marketing contact status" -> "Set as non-marketing"
 * 4. Save and activate the workflow
 * 5. Note the workflow ID from the URL
 * 6. Use this script to enroll contacts in that workflow
 */

const axios = require('axios');
require('dotenv').config();

const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

// You'll need to replace this with your actual workflow ID after creating the workflow
const WORKFLOW_ID = 'YOUR_WORKFLOW_ID_HERE'; // Get this from the workflow URL in HubSpot

/**
 * Enroll a contact in a workflow by email
 * API: POST /automation/v2/workflows/:workflowId/enrollments/contacts/:email
 */
async function enrollContactInWorkflow(email, workflowId) {
    try {
        const response = await axios.post(
            `https://api.hubapi.com/automation/v2/workflows/${workflowId}/enrollments/contacts/${email}`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`✓ Enrolled ${email} in workflow ${workflowId}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 409) {
            console.log(`⚠ ${email} already enrolled in workflow`);
            return { alreadyEnrolled: true };
        } else {
            console.error(`✗ Failed to enroll ${email}:`, error.response?.data || error.message);
            throw error;
        }
    }
}

/**
 * Batch enroll contacts with rate limiting
 */
async function batchEnrollContacts(contacts, workflowId, batchSize = 10, delayMs = 1000) {
    console.log(`Starting batch enrollment of ${contacts.length} contacts in workflow ${workflowId}`);
    
    const results = {
        enrolled: 0,
        alreadyEnrolled: 0,
        failed: 0,
        errors: []
    };
    
    for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(contacts.length / batchSize)} (${batch.length} contacts)`);
        
        const batchPromises = batch.map(async (contact) => {
            try {
                const result = await enrollContactInWorkflow(contact.email, workflowId);
                if (result.alreadyEnrolled) {
                    results.alreadyEnrolled++;
                } else {
                    results.enrolled++;
                }
                return { email: contact.email, success: true };
            } catch (error) {
                results.failed++;
                results.errors.push({ email: contact.email, error: error.message });
                return { email: contact.email, success: false, error: error.message };
            }
        });
        
        await Promise.all(batchPromises);
        
        // Rate limiting delay
        if (i + batchSize < contacts.length) {
            console.log(`Waiting ${delayMs}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('BATCH ENROLLMENT COMPLETE');
    console.log('='.repeat(50));
    console.log(`✓ Successfully enrolled: ${results.enrolled}`);
    console.log(`⚠ Already enrolled: ${results.alreadyEnrolled}`);
    console.log(`✗ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(err => {
            console.log(`  - ${err.email}: ${err.error}`);
        });
    }
    
    return results;
}

/**
 * Get workflow information
 */
async function getWorkflowInfo(workflowId) {
    try {
        const response = await axios.get(
            `https://api.hubapi.com/automation/v2/workflows/${workflowId}`,
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error('Failed to get workflow info:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Main function to update all ticket-handler contacts to non-marketable
 */
async function updateTicketHandlerContactsToNonMarketable() {
    console.log('SOLUTION: Setting Marketing Contact Status via Workflows');
    console.log('=' .repeat(60));
    
    if (WORKFLOW_ID === 'YOUR_WORKFLOW_ID_HERE') {
        console.error('❌ ERROR: You need to replace WORKFLOW_ID with your actual workflow ID');
        console.log('\nSTEPS TO GET WORKFLOW ID:');
        console.log('1. Go to HubSpot > Automation > Workflows');
        console.log('2. Create a new contact-based workflow');
        console.log('3. Set enrollment trigger to "Manual enrollment only"');
        console.log('4. Add action: "Set marketing contact status" -> "Set as non-marketing"');
        console.log('5. Save and activate the workflow');
        console.log('6. Copy the workflow ID from the URL (e.g., /workflows/12345678/edit)');
        console.log('7. Replace WORKFLOW_ID in this script with that ID');
        return;
    }
    
    try {
        // Verify workflow exists and is active
        console.log('Verifying workflow...');
        const workflow = await getWorkflowInfo(WORKFLOW_ID);
        console.log(`✓ Workflow found: "${workflow.name}" (ID: ${WORKFLOW_ID})`);
        console.log(`✓ Status: ${workflow.enabled ? 'Active' : 'Inactive'}`);
        
        if (!workflow.enabled) {
            console.error('❌ ERROR: Workflow is not active. Please activate it in HubSpot.');
            return;
        }
        
        // Load the verified ticket-handler contacts
        console.log('\nLoading ticket-handler contacts...');
        
        // Read the contact data from our previous analysis
        const fs = require('fs');
        let contacts = [];
        
        // Try to load from our previous verification file
        try {
            const data = fs.readFileSync('./verify_ticket_handler_creation_results.json', 'utf8');
            const results = JSON.parse(data);
            contacts = results.ticketHandlerContacts || [];
        } catch (error) {
            console.log('Previous verification file not found. Loading fresh data...');
            
            // Load fresh data using our existing logic
            const { getAllContacts } = require('./verify_ticket_handler_creation.js');
            const allContacts = await getAllContacts();
            
            // Filter for ticket-handler created contacts
            contacts = allContacts.filter(contact => 
                contact.hs_object_source === 'INTEGRATION' &&
                contact.hs_object_source_detail_1 === 'ticket-handler'
            );
        }
        
        console.log(`✓ Found ${contacts.length} ticket-handler contacts`);
        
        if (contacts.length === 0) {
            console.log('No ticket-handler contacts found to update.');
            return;
        }
        
        // Show sample of contacts to be updated
        console.log('\nSample contacts to be updated:');
        contacts.slice(0, 5).forEach(contact => {
            console.log(`  - ${contact.email} (ID: ${contact.id})`);
        });
        if (contacts.length > 5) {
            console.log(`  ... and ${contacts.length - 5} more`);
        }
        
        // Confirm before proceeding
        console.log(`\n⚠ About to enroll ${contacts.length} contacts in workflow "${workflow.name}"`);
        console.log('This will set them all to NON-MARKETING status.');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Start batch enrollment
        console.log('\nStarting batch enrollment...');
        const results = await batchEnrollContacts(contacts, WORKFLOW_ID, 10, 1000);
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `./workflow_enrollment_results_${timestamp}.json`;
        
        fs.writeFileSync(resultsFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            workflowId: WORKFLOW_ID,
            workflowName: workflow.name,
            totalContacts: contacts.length,
            results,
            contacts: contacts.map(c => ({ id: c.id, email: c.email }))
        }, null, 2));
        
        console.log(`\n📁 Results saved to: ${resultsFile}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('IMPORTANT: VERIFICATION');
        console.log('='.repeat(60));
        console.log('After enrollment, contacts will be processed by the workflow.');
        console.log('This may take a few minutes to complete.');
        console.log('You can check the workflow performance in HubSpot > Automation > Workflows');
        console.log(`View your workflow: https://app.hubspot.com/workflows/${workflow.portalId}/${WORKFLOW_ID}/performance`);
        
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        if (error.response?.data) {
            console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Export functions for use in other scripts
module.exports = {
    enrollContactInWorkflow,
    batchEnrollContacts,
    getWorkflowInfo,
    updateTicketHandlerContactsToNonMarketable
};

// Run if called directly
if (require.main === module) {
    updateTicketHandlerContactsToNonMarketable();
}
