import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def make_session():
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    s = requests.Session()
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


session = make_session()
