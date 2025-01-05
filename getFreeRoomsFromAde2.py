import re, requests
from datetime import datetime, timezone

class getJSESSIONID:

    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0"}
        self.JSESSIONID = None
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.sess = requests.Session()
    def getCookie(self):
        self.rq = self.sess.get("https://planif.esiee.fr/", headers=self.headers)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        self.JSESSIONID = self.repH.get("Set-Cookie")
        
        return self.JSESSIONID


s = getJSESSIONID()

class getXHR1:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID, "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = "7|0|7|https://planif.esiee.fr/direct/gwtdirectplanning/|65782F4BD6A979FD5D493428851A7CD3|com.adesoft.gwt.core.client.rpc.ConfigurationServiceProxy|method1getInitialConfiguration|J|java.lang.String/2004016611|fr|1|2|3|4|2|5|6|ZQrtw$m|7|"
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/ConfigurationServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n")




class getXHR4:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID, "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = "7|0|9|https://planif.esiee.fr/direct/gwtdirectplanning/|1DB505FD9B7EA449BBDD73013628438C|com.adesoft.gwt.core.client.rpc.WebClientServiceProxy|method1login|J|com.adesoft.gwt.core.client.rpc.data.LoginRequest/3705388826|com.adesoft.gwt.directplan.client.rpc.data.DirectLoginRequest/635437471|lecteur1||1|2|3|4|2|5|6|ZQrwXtk|7|0|0|0|0|0|8|9|-1|0|0|"
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/WebClientServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

class getXHR5:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID, "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = "7|0|5|https://planif.esiee.fr/direct/gwtdirectplanning/|1DB505FD9B7EA449BBDD73013628438C|com.adesoft.gwt.core.client.rpc.WebClientServiceProxy|method4getProjectList|J|1|2|3|4|1|5|ZQrwXtk|"
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/WebClientServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        d2d2 = {}
        ch = self.repT.split('{"')[1:]
        for e in ch:
            n, a = e.split('""')[:2]
            d2d2[a] = n
        return d2d2


class getXHR7:
    def __init__(self, JSESSIONID: str, idAnnee: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID, "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.idAnnee = idAnnee
        self.reqT = f"7|0|7|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method13loadProject|J|I|Z|1|2|3|4|3|5|6|7|ZQrwXtk|{self.idAnnee}|1|"
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        
class getXHRAmphis:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"795""true""2""-1""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""01-Amphis""false""false""01-Enseignement.01-Amphis""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        amphisLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        #print(amphisLst)
        lst = []
        for ae in amphisLst:
            #print(">>", ae.split('\\"\\"'))
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst







class getXHREnseignRooms:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC"}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"-3""true""0""-1""2""2""0""false"[1]{"StringField""NAME""LabelName""Salles""false""false""""classroom""3""0"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        amphisLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        #print(amphisLst)
        lst = []
        for ae in amphisLst:
            #print(">>", ae.split('\\"\\"'))
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst



class getXHRVideo16:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:791"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"175""true""3""-1""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 16""false""false""01-Enseignement.03-Vidéo.vidéo capacité 16""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst


class getXHRVideo28:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"3352""true""3""19""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 28""false""false""01-Enseignement.03-Vidéo.vidéo capacité 28""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst






class getXHRVideo30:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"2271""true""3""9""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 30""false""false""01-Enseignement.03-Vidéo.vidéo capacité 30""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst

class getXHRVideo32:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"2700""true""3""5""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 32""false""false""01-Enseignement.03-Vidéo.vidéo capacité 32""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst

class getXHRVideo40:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = "" # ZQrwXtk
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"5819""true""3""1""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 40""false""false""01-Enseignement.03-Vidéo.vidéo capacité 40""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst

class getXHRVideo48:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = "" # ZQrwXtk
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"184""true""3""3""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 48""false""false""01-Enseignement.03-Vidéo.vidéo capacité 48""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst

class getXHRVideo52:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = "" # ZQrwXtk
        self.reqT = '7|0|12|https://planif.esiee.fr/direct/gwtdirectplanning/|A0AD6035033F296E20376B66C2082700|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method8getTimetable|J|com.adesoft.gwt.core.client.rpc.data.planning.PlanningSelection/886937684|I|Z|java.util.List|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|Cumul|1|2|3|4|6|5|6|7|7|8|9|ZQrwXtk|6|10|7|11|0|11|1|11|2|11|3|11|4|11|5|11|6|25|12|0|10|1|11|184|10|1|11|22|1235|197|1|10|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst

class getXHRVideo72:
    def __init__(self, JSESSIONID: str):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = "" # ZQrwXtk
        self.reqT = '7|0|20|https://planif.esiee.fr/direct/gwtdirectplanning/|BB468225DBC62C7786D92BE512B62089|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"3357""true""3""8""0""0""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""vidéo capacité 72""false""false""01-Enseignement.03-Vidéo.vidéo capacité 72""classroom""3""2"[0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/3992110146|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/640452531|1|2|3|4|3|5|6|7|ZQrwXtk|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

        roomsLst = self.repT.replace("]{\\\"Color", "Color").split("]{\\\"")[1:]
        
        lst = []
        for ae in roomsLst:
            lst.append({ae.split('\\"\\"')[18]: ae.split('\\"\\"')[0]})
        return lst


class getXHRVideoNSelect01:
    def __init__(self, JSESSIONID: str, roomId: str, week: int, numPeriod: int):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = f'7|0|12|https://planif.esiee.fr/direct/gwtdirectplanning/|A0AD6035033F296E20376B66C2082700|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method5getLegends|J|com.adesoft.gwt.core.client.rpc.data.planning.PlanningSelection/886937684|com.extjs.gxt.ui.client.data.SortInfo/1143517771|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|Cumul|com.extjs.gxt.ui.client.Style$SortDir/640452531|NAME|1|2|3|4|3|5|6|7|ZQrwXtk|6|8|7|9|0|9|1|9|2|9|3|9|4|9|5|9|6|25|10|0|8|1|9|{roomId}|8|1|9|{week}|7|11|1|{numPeriod}|'
    
    def post(self):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        #print(self.repH, "\n\n\n\n", self.repT)

class getXHRVideoNSelect03:
    def __init__(self, JSESSIONID: str, roomId: str, week: int, numPeriod: int):
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "Cookie": JSESSIONID + """Direct Planning Tree	'{"state":{"sortField":"s:NAME", "sortDir":"s:ASC", "expanded":["s:-3","s:49","s:2271"]}}'""", "X-GWT-Module-Base": "https://planif.esiee.fr/direct/gwtdirectplanning/", "X-GWT-Permutation": "84978C43E1DD9746A3991E03E83BCE38", "Content-Type": "text/x-gwt-rpc; charset=utf-8"}
        
        self.rq = None
        self.repH = {}
        self.repT = ""
        self.reqT = f'7|0|12|https://planif.esiee.fr/direct/gwtdirectplanning/|A0AD6035033F296E20376B66C2082700|com.adesoft.gwt.directplan.client.rpc.DirectPlanningPlanningServiceProxy|method8getTimetable|J|com.adesoft.gwt.core.client.rpc.data.planning.PlanningSelection/886937684|I|Z|java.util.List|java.util.ArrayList/4159755760|java.lang.Integer/3438268394|Cumul|1|2|3|4|6|5|6|7|7|8|9|ZQrwXtk|6|10|7|11|0|11|1|11|2|11|3|11|4|11|5|11|6|25|{numPeriod}|0|10|1|11|{roomId}|10|1|11|{week}|1235|185|1|10|0|' # 
    @staticmethod
    def ProcessDay(tab: list):
        lst = []
        indDays = []
        for i in range(len(tab) - 1):
            e = tab[i]
            if (175 <= e <= 178) and e != tab[i+1] < 140:
                co = tab[i-2:i+3]
                lst.append(co)
                indDay = co[1] // 176
                indDays.append(indDay)
        lst.reverse()
        indDays.reverse()
        
        return indDays
    @staticmethod
    def ProcessWhereAreBusy(aaa: str, roomName: str):
        def getTheDayOfWeek():
            dtn = datetime.now()
            dtn = datetime(dtn.year, dtn.month, dtn.day, 0, 0, 0, 0)
            dt1 = datetime(2024, 12, 30, 0, 0, 0, 0)

            return ((dtn - dt1).days) % 7
        dictInfos = {"capacity": {"0110": 116, "0160": 116, "0210": 156, "0260": 156}}
        roomNum = "/"
        capacity = -1
        if roomName.count(".") >= 2:
            roomNum = roomName.split(".")[-1]
            if "Amphis" in roomName:
                capacity = dictInfos["capacity"].get(roomNum)
            else:
                try:
                    capacity = int(roomName.split(".")[-2].split(" ")[-1])
                except:
                    capacity = -1
            
            t = [int(x) for x in aaa.split("//OK[")[1].split(",[")[0].split(",")]
            lst = []
            cons = 2
            daysTab = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
            dictRoom = {roomNum: {"capacity": capacity, "busy": [], "date": ""}}
            for i in range(len(t) - 1):
                e = t[i]
                if (174 <= e <= 178) and e != t[i+1] < 140:
                    co = t[i-2:i+4]
                    indDay = co[1] // 176
                    
                    if indDay == getTheDayOfWeek():
                        dictRoom[roomNum]["date"] = daysTab[indDay] + datetime.now().strftime(" %d/%m/%Y")
                        dateStart = datetime.fromtimestamp(((co[0] / 12.75 + 7.5) + 0.02) * 3600, timezone.utc).strftime("%Hh%M")[:-1] + "0"
                        dateEnd = datetime.fromtimestamp(((co[0] / 12.75 + 7.5 + co[3] / 12.75)) * 3600, timezone.utc).strftime("%Hh%M")[:-1] + "0"
                        dateStart = dateStart.replace("h20", "h30")
                        dateEnd = dateEnd.replace("h20", "h30")
                        if "50" in dateStart:
                            h, m = dateStart.split("h")
                            dateStart = str(int(h) + 1) + "h00"
                        if "50" in dateEnd:
                            h, m = dateEnd.split("h")
                            dateEnd = str(int(h) + 1) + "h00"
                        lst.append(daysTab[indDay] + datetime.now().strftime(" %d/%m/%Y room: ") + roomNum + " (capacity: " + str(capacity) + ") " + dateStart + " -> " + dateEnd)
                        hS, mS = dateStart.split("h")
                        hE, mE = dateEnd.split("h")
                        dictRoom[roomNum]["busy"].append([(int(hS), int(mS)), (int(hE), int(mE))])
                    
            lst.reverse()
            #print(roomNum, capacity, lst)
            busy = dictRoom[roomNum]["busy"]
            busy.sort()
            dictRoom[roomNum]["busy"] = busy
            return dictRoom#lst
        return {roomNum: {"capacity": capacity, "busy": -1, "date": "/"}}
    @staticmethod
    def ProcessSubjects(aaa: str):
        sv = aaa.split(",[")[1].split(",")[5:-2]

        lst = []
        mustCreate = True
        for i in range(len(sv)):
            if mustCreate:
                lst.append("")
                mustCreate = False
            a = re.search(r'\b(1[0-2]|0?[1-9])h[0-5][0-9]\b', sv[i])
            if a != None:
                mustCreate = True
            lst[-1] += sv[i].replace('"', '') + "\n"

        return lst

    def post(self, roomName: str):
        self.rq = s.sess.post("https://planif.esiee.fr/direct/gwtdirectplanning/DirectPlanningPlanningServiceProxy", headers=self.headers, data=self.reqT)
        self.repH, self.repT = (self.rq.headers, self.rq.text)
        # print(self.repH, "\n\n\n\n", self.repT)
        
        return self.ProcessWhereAreBusy(self.repT, roomName)


def getTheCurrentWeek():
    dtn = datetime.now()
    dtn = datetime(dtn.year, dtn.month, dtn.day, 0, 0, 0, 0)
    dt1 = datetime(2024, 12, 30, 0, 0, 0, 0)
    weekN = (dtn - dt1).days // 7
    normalWeek = (weekN % 52) + 19
    if normalWeek >= 52:
        normalWeek -= 59
    return normalWeek




class AdeRequest:
    def __init__(self):
        self.dictRooms = None
        self.yWeek = getTheCurrentWeek()
        self.numPeriod = 12
        dt = datetime.now()
        if dt.month >= 9:
            self.numPeriod = (dt.year - 2024) + 12
        else:
            self.numPeriod = (dt.year - 2025) + 12
    
    def getRoomsInfos(self):
        s = getJSESSIONID()
        cookie = s.getCookie()
        print(cookie)
        cookie = cookie.replace(" Path=/direct; Secure", "")
        x1 = getXHR1(cookie)
        x1.post()
        x4 = getXHR4(cookie)
        x4.post()

        x5 = getXHR5(cookie)
        d2d2 = x5.post()

        num = self.numPeriod #input(str(d2d2) + "\n>>> Choose one Period with index (ex: 2024-2025: 12) >/ ")

        x7 = getXHR7(cookie, num)
        x7.post()

        yWeek = self.yWeek # int(input("Numero de semaine (ex: semaine du 20 janvier au 26 -> 4) >/ "))

        dictRooms = {}

        xAmphis = getXHRAmphis(cookie)
        lstAmphis = xAmphis.post()

        for e in lstAmphis:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v


        xRoomsVideo16 = getXHRVideo16(cookie)
        lst16 = xRoomsVideo16.post()
        for e in lst16:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v



        xRoom28 = getXHRVideo28(cookie)
        lst28 = xRoom28.post()
        for e in lst28:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v


        xRoom30 = getXHRVideo30(cookie)
        lst30 = xRoom30.post()
        for e in lst30:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v


        xRoom32 = getXHRVideo32(cookie)
        lst32 = xRoom32.post()
        for e in lst32:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v



        xRoom40 = getXHRVideo40(cookie)
        lst40 = xRoom40.post()
        for e in lst40:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v


        xRoom48 = getXHRVideo48(cookie)
        lst48 = xRoom48.post()
        for e in lst48:
            ind1 = list(e.items())[0][1]
            xRoomxyS1 = getXHRVideoNSelect01(cookie, ind1, yWeek, num)
            xRoomxyS1.post()
            xRoomxyS3 = getXHRVideoNSelect03(cookie, ind1, yWeek, num)
            res = xRoomxyS3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v


        xRoom72 = getXHRVideo72(cookie)

        lst72 = xRoom72.post()


        for e in lst72:
            indVideo72 = list(e.items())[0][1]
            xRoom72S1 = getXHRVideoNSelect01(cookie, indVideo72, yWeek, num)
            xRoom72S1.post()
            xRoom72S3 = getXHRVideoNSelect03(cookie, indVideo72, yWeek, num)
            res = xRoom72S3.post(list(e)[0])
            for (k, v) in res.items():
                if "old" not in k:
                    dictRooms[k] = v
        self.dictRooms = dictRooms
        return self.dictRooms
    
    def getCurrentsFreeRooms(self):
        if self.dictRooms == None:
            self.dictRooms = self.getRoomsInfos()
        d = self.dictRooms.copy()
        dtn = datetime.now()
        free = {}
        for (k, v) in d.items():
            busy = v["busy"]
            if type(busy) == list:
                for i in range(len(busy)):
                    ts, te = busy[i]

                    if ((dtn.hour * 60) + dtn.minute) < ((ts[0] * 60) + ts[1]):
                        v.update({"isFree": True, "freeUntil": str(ts[0]).zfill(2) + "h" + str(ts[1]).zfill(2)})
                        free[k] = v
                        break
                    elif ((dtn.hour * 60) + dtn.minute) < ((te[0] * 60) + te[1]):
                        break
                    elif i == (len(busy) - 1):
                        v.update({"isFree": True, "freeUntil": "demain ^^"})
                        free[k] = v
                if busy == []:
                    v.update({"isFree": True, "freeUntil": "demain ^^"})
                    free[k] = v
        return free


### Exemple d'utilisation
