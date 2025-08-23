# HubSpot Workflow Setup Guide: Set Marketing Contact Status

## The Problem
The `hs_marketable_status` property is **READ-ONLY** and cannot be updated via API. This is why all direct API attempts to update marketing contact status fail.

## The Solution
Use HubSpot Workflows with the "Set marketing contact status" action, then enroll contacts via the Workflows API.

## Step-by-Step Setup

### 1. Create the Workflow in HubSpot

1. **Go to HubSpot**
   - Navigate to: **Automation > Workflows**

2. **Create New Workflow**
   - Click **"Create workflow"**
   - Select **"Contact-based"**
   - Choose **"Blank workflow"**

3. **Set Enrollment Trigger**
   - For the enrollment trigger, select **"Manual enrollment only"**
   - This prevents automatic enrollment and lets us control it via API

4. **Add the Action**
   - Click **"+"** to add an action
   - Search for and select **"Set marketing contact status"**
   - Choose **"Set as non-marketing"**

5. **Configure Settings**
   - Give your workflow a descriptive name like "Set Contacts to Non-Marketing"
   - Add a description: "Used to programmatically set contacts as non-marketing via API"

6. **Save and Activate**
   - Click **"Review and publish"**
   - Click **"Turn on"** to activate the workflow

7. **Get the Workflow ID**
   - Once created, note the workflow ID from the URL
   - URL format: `https://app.hubspot.com/workflows/[portal-id]/[workflow-id]/edit`
   - Copy the `[workflow-id]` number

### 2. Update the Script

1. **Open the script file:**
   ```bash
   code utils/marketing_status_workflow_solution.js
   ```

2. **Replace the workflow ID:**
   ```javascript
   // Replace this line:
   const WORKFLOW_ID = 'YOUR_WORKFLOW_ID_HERE';
   
   // With your actual workflow ID:
   const WORKFLOW_ID = '12345678'; // Your actual workflow ID
   ```

### 3. Run the Script

```bash
node utils/marketing_status_workflow_solution.js
```

## How It Works

1. **Workflow Creation**: The workflow contains the "Set marketing contact status" action
2. **API Enrollment**: The script uses the Workflows API to enroll contacts
3. **Automatic Processing**: HubSpot processes enrolled contacts and updates their marketing status
4. **Status Change**: Contacts are set to non-marketing (takes effect on next billing cycle)

## API Endpoints Used

- **Enroll Contact**: `POST /automation/v2/workflows/{workflowId}/enrollments/contacts/{email}`
- **Get Workflow Info**: `GET /automation/v2/workflows/{workflowId}`

## Expected Results

- **Total Contacts**: 1,439 ticket-handler contacts
- **Action**: Each will be enrolled in the workflow
- **Outcome**: All will be set to non-marketing status
- **Billing Impact**: Will take effect on next HubSpot billing cycle

## Verification

After running the script:

1. **Check Workflow Performance**
   - Go to: **Automation > Workflows**
   - Click on your workflow
   - View the **"Performance"** tab to see enrollment and completion stats

2. **Verify Contact Status**
   - Check a few contacts manually in HubSpot
   - Look for the "Marketing contact" property
   - It should show as "Non-marketing contact"

3. **Monitor Billing**
   - Go to: **Settings > Account & Billing > Usage & Limits**
   - Check the marketing contacts count after the next billing cycle

## Troubleshooting

### Common Issues

1. **Workflow ID Error**
   - Make sure you copied the correct ID from the URL
   - The ID should be a number, not the workflow name

2. **Workflow Not Active**
   - Ensure the workflow is published and turned on
   - Check that it's not paused or has errors

3. **Permission Issues**
   - Your API token needs workflow access permissions
   - Check that your HubSpot plan supports workflows

4. **Rate Limiting**
   - The script includes rate limiting (10 contacts per second)
   - If you hit limits, the script will handle retries

### API Response Codes

- **200**: Success - Contact enrolled
- **409**: Contact already enrolled (will skip)
- **404**: Workflow not found or inactive
- **403**: Permission denied

## Important Notes

1. **Billing Timing**: Marketing status changes take effect on your next billing cycle date, not immediately
2. **Audit Trail**: The workflow provides a clear audit trail of which contacts were changed
3. **Reversible**: You can create another workflow to set contacts back to marketing if needed
4. **Rate Limits**: HubSpot has API rate limits - the script handles this automatically

## Alternative Approaches (if needed)

If workflows don't work for your use case:

1. **Bulk UI Update**: Manually select contacts in HubSpot and use "Set as non-marketing"
2. **Import Method**: Export contacts, modify the file, and re-import with marketing status
3. **Form Submission**: Create a form that sets contacts as non-marketing and submit via API

## Documentation References

- [HubSpot Workflows API](https://developers.hubspot.com/docs/reference/api/automation/create-manage-workflows)
- [Marketing Contact Status in Workflows](https://knowledge.hubspot.com/workflows/choose-your-workflow-actions#set-marketing-contact-status)
- [Understanding Marketing Contacts](https://knowledge.hubspot.com/contacts/set-contacts-as-marketing)
