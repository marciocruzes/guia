import { JwtHelper } from 'angular2-jwt';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { MensagemService } from './../mensagem/mensagem.service';
import { Injectable } from '@angular/core';
import { Http, Response, Headers } from '@angular/http';
import { AppConfig } from '../app.config';
import { Observable } from 'rxjs/Rx';

@Injectable()
export class GuiaService {

    constructor(private config: AppConfig, private http: Http, private mensagem: MensagemService, private jwt: JwtHelper) { }

    private token:string;
    private headers:Headers = new Headers();    
    private numCartao:string = sessionStorage.getItem('numCartao');
    loading: boolean;

    static pretadorResultado = new BehaviorSubject('');
    static resultado = new BehaviorSubject('');
    static detalhe = new BehaviorSubject('');  


    private _getFiltro(url):Observable<any> {       
        return this.http.get(this.config.getConfig('url_microservice') + url, {headers: this.headers})        
    }

    async getTokenGuia() {

        let url = this.config.getConfig('url_microservice') + 'guia/medico/secure/auth/login'; 
        const body = {name: this.config.getConfig('name_token'), password:this.config.getConfig('password_token')};

        if(!!localStorage.getItem('GuiaPlano')) {

            if(this.jwt.isTokenExpired(JSON.parse(localStorage.getItem('GuiaPlano')).token)) {
                // console.log('token expirado.')
                await this.http.post(url, body).toPromise().then(res => {
            
                        let resultado = JSON.parse(res['_body']);
                        if(!!localStorage.getItem('GuiaPlano'))
                            localStorage.removeItem('GuiaPlano');
                        localStorage.setItem('GuiaPlano', JSON.stringify({ token: resultado['data']['token'] }));
            
                        this.token = JSON.parse(localStorage.getItem('GuiaPlano')).token;
                        this.headers.set('Authorization', 'Bearer ' + this.token);
                        this.headers.set('mimeType','multipart/form-data');
                        
                    }).catch(error => {
                        let resultado = JSON.parse(error['_body']);
                        this.config.mensagemConfirmacao(resultado);
                    })

            } else {
                this.token = JSON.parse(localStorage.getItem('GuiaPlano')).token;
                this.headers.set('Authorization', 'Bearer ' + this.token);
                this.headers.set('mimeType','multipart/form-data');
            }
        } else {

            await this.http.post(url, body).toPromise().then(res => {
                    // console.log('Gerando token guia...')
            
                    let resultado = JSON.parse(res['_body']);   
                    if(!!localStorage.getItem('GuiaPlano'))
                        localStorage.removeItem('GuiaPlano');
                    localStorage.setItem('GuiaPlano', JSON.stringify({ token: resultado['data']['token'] }));
        
                    this.token = JSON.parse(localStorage.getItem('GuiaPlano')).token;
                    this.headers.set('Authorization', 'Bearer ' + this.token);
                    this.headers.set('mimeType','multipart/form-data');
                    
                }).catch(error => {
                    let resultado = JSON.parse(error['_body']);
                    this.config.mensagemConfirmacao(resultado);
                })
        }

    }

    getPrestador(url_prestador, nomeModalidade, especialidade, municipio, nomeBairro, latitude?, longitude?, pagina?):Observable<any> {

        let url = this.config.getConfig('url_microservice') + url_prestador;
        var form = new FormData();

        GuiaService.pretadorResultado.next(`${url_prestador}+${nomeModalidade}+${especialidade}+${municipio}+${nomeBairro}+${latitude}+${longitude}`);

        //Obrigatorio
        form.append("numCartao", this.numCartao);        
        form.append("nomeModalidade", nomeModalidade);
        form.append("especialidade", especialidade);

        //Se Aproximidade for marcado, municipio e bairro não são enviados para a API.
        if(!!latitude && !!longitude) {
            // console.log('coordenadas')
            form.append("latitude", latitude);
            form.append("longitude", longitude);
        }
         else {
            form.append("nomeMunicipio", municipio); 
            (!!nomeBairro) ? form.append("nomeBairro", nomeBairro) : null;     
        }         

        if(!!pagina) {
            form.append("pagina", pagina)
        }

        return this.http.post(url, form, {headers : this.headers});
    }

    getPrestadorResultado(url_prestador, nomeModalidade, especialidade, municipio, nomeBairro, pagina, latitude?, longitude?):Observable<any> {

        let url = this.config.getConfig('url_microservice') + url_prestador;
        var form = new FormData();

        //Obrigatorio
        form.append("numCartao", this.numCartao);      
        form.append("nomeModalidade", nomeModalidade);
        form.append("especialidade", especialidade);
        form.append("pagina", pagina)        

        // Se Aproximidade for marcado, municipio e bairro não são enviados para a API.
        if(latitude  != "undefined" && longitude != "undefined") {
            // console.log('coordenadas')
            form.append("latitude", latitude);
            form.append("longitude", longitude);
        }
         else {
            form.append("nomeMunicipio", municipio); 
            (nomeBairro != "undefined" ) ? form.append("nomeBairro", nomeBairro) : null;     
        }   

        return this.http.post(url, form, {headers : this.headers});
    }

    getPalavraChave(url_palavra_chave, palavraChave):Observable<any> {

        let url = this.config.getConfig('url_microservice')  + this.config.getConfig(url_palavra_chave);

        let form = new FormData();
        form.append("numCartao", this.numCartao);
        form.append("palavraChave", palavraChave);

        return this.http.post(url, form, {headers: this.headers});
    }

    filtroLocalidades(url, munic, bairro, listaLocalidade, loading?) {    
        
        if(typeof munic == 'string'){
            var municipio = munic;
            // console.log(municipio.toUpperCase());
        } else {
            municipio =  (!!munic.nativeElement) ? munic.nativeElement.innerHTML : munic.textContent;
        }

        this._getFiltro(url).subscribe(
            res => {

                let localidades = JSON.parse(res['_body']); // Resultado da requisicao em formato JSON.
                let flag = true;
                listaLocalidade.length = 0;
                $('#bairro').prop('selectedIndex',0);

                for(let localidade in localidades) { // Para cada item do JSON faça. 
                    if(municipio == localidades[localidade]['municipio']) { // Verifica se o municipio é o mesmo que foi selecionado pelo usuario.                        
                        flag = false;
                        bairro.nativeElement.disabled = false;
                        for(let bairro in localidades[localidade]['bairros']) {
                            listaLocalidade.push(localidades[localidade]['bairros'][bairro])// Retorna somente os bairros do municipio selecionado.  
                        }                                                   
                    }               
                }
                if(flag) {
                    listaLocalidade.length = 0; // Limpa a base caso não tenha itens
                    bairro.nativeElement.disabled = true;
                }
                (!!loading) ? loading.push(false) : null
            }, erro => {
                this.mensagem.notify('Erro ao trazer a lista de Bairros', 'alert alert-danger');
                loading.push(false)
            }
        )
    }   

    

    filtroModalidadeEspecialidade(url, listaModalidade, listaModalidadeEspecialidade, loading?) {

        this._getFiltro(url).subscribe(
            res => {
                let modalidadeEspecialidades = JSON.parse(res['_body']); // Resultado da requisicao em formato JSON.
                // console.log(res)
                for(let cada in modalidadeEspecialidades) { // Para cada item do JSON faça.
                    listaModalidade.push(modalidadeEspecialidades[cada]['modalidade']) // Monta a lista de Modalidade e manda para a View.
                    listaModalidadeEspecialidade.push(modalidadeEspecialidades[cada]) // Monta uma unica vez a lista de Modalidade e Especialidade
                }
                (!!loading) ? loading.push(false) : null               
            },
            erro => {
                this.mensagem.notify('Erro ao trazer a lista de Modalidades e Especialidades', 'alert alert-danger');
                loading.push(false)
            } 
        )
    }

    filtroRedePlanos() {

        this._getFiltro(this.config.getConfig('url_medico_filtro_redesplanos')).subscribe(
            res => console.log(res)
        )
    }

    filtroEspecialidadeDental(listaEspecialidade: Array<object>) {
        this._getFiltro(this.config.getConfig('url_dental_filtro_modalidades_especialidades')).subscribe(
            res => {
                let resultado = JSON.parse(res['_body']);

                for(let especialidade in resultado[0]['especialidades']) {
                    listaEspecialidade.push(resultado[0]['especialidades'][especialidade])
                }

            }, err => {
                this.mensagem.notify('Ocorreu um erro para listar as especialidades.', 'alert alert-danger')
            }
        )
    }

    lstEspecialidade(opcaoEscolhida, listaModalidadeEspecialidade, espec, listaEspecialidade, listaServico?, flagServicos?) {

        let modalidade = opcaoEscolhida.target.value; // Pega o valor selecionado
        if(modalidade != 'Modalidade') { // Verifica se é um valor default
            for(let cada in listaModalidadeEspecialidade){ // Recupera a lista de Modalidade e Especialidade
                if(modalidade == listaModalidadeEspecialidade[cada]['modalidade']) // Verifica se é a modalidade selecionada
                {   
                    listaEspecialidade.length = 0;  

                    for(let especialidade in listaModalidadeEspecialidade[cada]['especialidades']) {
                        listaEspecialidade.push(listaModalidadeEspecialidade[cada]['especialidades'][especialidade])
                    }

                    listaServico.length = 0;
                    flagServicos.length = 0;

                    if((listaModalidadeEspecialidade[cada]['servicos']).length > 0) {
                        
                        flagServicos.push(true);

                        for(let servico in listaModalidadeEspecialidade[cada]['servicos']) {
                            listaServico.push(listaModalidadeEspecialidade[cada]['servicos'][servico])
                        }
                    } else {
                        flagServicos.push(false);
                    }

                    espec.nativeElement.disabled = false; // Habilita o combo de Especialidade
                    opcaoEscolhida.target[0].style.display = 'none';
                }            
            }
        } else { 
            listaEspecialidade.length = 0; // Se for default, ele zera o array
            espec.nativeElement.disabled = true; // Desabilita o combo de Especialidade
        }
    }

    // Serviços do Guia e Favoritos em Detalhes.

    calcularDistancia(origem, destino):Observable<any> {       

        let url = this.config.getConfig('api_google_distancia').replace('{origem}', origem).replace('{destino}', destino);
        return this.http.get(url)
    }

    calcularEndereco(lat, long):Observable<any> {
        let url = this.config.getConfig('api_google_endereco').replace('{latitude}', lat).replace('{longitude}', long);
        return this.http.get(url)
    }

    favoritos(urlFavoritos, idPrestador, modalidade?):Observable<any> {
        let url = this.config.getConfig('url_microservice') + this.config.getConfig(urlFavoritos);
        
        var form = new FormData();
        form.append("numCartao", this.numCartao);        
        form.append("idPrestador", idPrestador);
        form.append("modalidade", modalidade);

        return this.http.post(url, form, {headers : this.headers});
    }
    
    removeSelecioneSelect(event: Event) {
        event.target[0].style.display = 'none';
    }

    ordenacaoGuiaResultado(medicos: Object[]) {
        medicos.sort((a, b) => {
            if(a['distancia']) {
                return a['distancia'] - b['distancia']
            } else {
                return a['nomePrestador'] - b['nomePrestador']
            }
       });
    }
                        
}
