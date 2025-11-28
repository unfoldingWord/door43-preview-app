#!/bin/bash

# Set the bucket name
BUCKET_NAME="preview.door43.org"

# List all files with .gzip extension in the bucket
FILES=$(aws s3 ls s3://$BUCKET_NAME/ --recursive | grep '.gzip$' | awk '{print $4}')

# Loop through the list of .gzip files
for FILE in $FILES; do
  echo $FILE
  # Create new file name by replacing .gzip with .gz
  NEW_FILE=$(echo $FILE | sed 's/.gzip$/.gz/')

  # Copy the .gzip file to .gz in the same bucket
  aws s3 cp s3://$BUCKET_NAME/$FILE s3://$BUCKET_NAME/$NEW_FILE

  # Check if copy was successful
  if [ $? -eq 0 ]; then
    # Delete the original .gzip file
    aws s3 rm s3://$BUCKET_NAME/$FILE
    echo "Successfully renamed $FILE to $NEW_FILE"
  else
    echo "Failed to rename $FILE"
  fi
done
