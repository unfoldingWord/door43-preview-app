from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import requests



completed_urls = []
try:
  with open('./completed_urls', 'r') as file:
    completed_urls = file.read().splitlines()
except FileNotFoundError:
  pass

# Setup Chrome options
chrome_options = webdriver.ChromeOptions()

# Set the location of the webdriver
webdriver_service = Service(ChromeDriverManager().install())

# Initialize the driver

# url = "http://git.door43.org/api/v1/catalog/search?owner=unfoldingWord&owner=Door43-Catalog&subject=TSV+Translation+Notes&stage=latest&limit=1"
url = "http://git.door43.org/api/v1/catalog/search?owner=unfoldingWord&owner=Door43-Catalog&subject=Aligned+Bible&subject=Bible&subject=Greek+New+Testament&subject=Hebrew+Old+Testament&subject=Open+Bible+Stories&subject=Translation+Words&subject=TSV+Translation+Notes&subject=TSV+Translation+Questions&stage=latest&sort=released&order=desc&limit=1"

response = requests.get(url)
entries = response.json()['data']

driver = webdriver.Chrome(service=webdriver_service, options=chrome_options)
wait = WebDriverWait(driver, 60)  # adjust the timeout as needed

root = "https://preview.door43.org"
temp_url = "about:blank"

# Loop through the entries
for entry in entries:
    for ingredient in entry['ingredients']:
      url = "/u/unfoldingWord/en_tn/v71#psa"
      # url = f"/u/{entry['full_name']}/{entry['branch_or_tag_name']}?rerender=1#{ingredient['identifier']}"
      # if url in completed_urls:
      #   continue

      print(root+url)
  
      try:
        driver.get(temp_url)
        
        # Open the page
        driver.get(root+url)

        # Wait for the component to load
        # wait.until(EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'Error')] | //div[@id='web-preview'][child::*]")))

        # Wait for the button to not be disabled or for the div with text "Error" to appear
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[value=print]")) or EC.presence_of_element_located((By.XPATH, "//div[contains(text(), 'Error')]")))
        
        print("SUCCESS: "+url)
        # Add a delay to ensure the page has fully loaded (adjust as needed)
        # time.sleep(5)
        # Read the completed URLs from the file if it exists

        # Add the completed URL to the array
        completed_urls.append(url)

        # Save the completed URLs to the file
        with open('./completed_urls', 'w') as file:
          file.write('\n'.join(completed_urls))

        time.sleep(2)
      except Exception as e:
        print("ERROR: "+url)
        print(e)
        continue
      break
    break

# Close the WebDriver
driver.quit()