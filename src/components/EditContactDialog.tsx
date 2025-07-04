
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useContacts } from '@/hooks/useContacts';
import { useContactDialogData } from '@/hooks/useContactDialogData';
import { EncounterWithGodField } from './contact-form/EncounterWithGodField';
import { BaptizedField } from './contact-form/BaptizedField';
import { ReferralAndCellFields } from './contact-form/ReferralAndCellFields';
import { FounderField } from './contact-form/FounderField';
import { LeaderField } from './contact-form/LeaderField';
import { PhotoUpload } from './PhotoUpload';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCheck, ArrowRightLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  context?: 'cell' | 'contacts';
  onContactUpdated?: () => void;
}

export function EditContactDialog({ open, onOpenChange, contact, context = 'contacts', onContactUpdated }: EditContactDialogProps) {
  console.log('EditContactDialog: Renderizando com contact:', contact);
  console.log('EditContactDialog: Dialog open:', open);

  const { updateContact } = useContacts();
  // Usando apenas useContactDialogData para evitar duplicação
  const { neighborhoods, cities, cells, contacts, profiles } = useContactDialogData(open);

  const [form, setForm] = useState({
    name: '',
    whatsapp: '',
    email: '',
    neighborhood: '',
    city_id: '',
    birth_date: '',
    encounter_with_god: false,
    baptized: false,
    status: 'pending',
    cell_id: '',
    referred_by: '',
    photo_url: null,
    founder: false,
    leader_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log('EditContactDialog: useEffect executado');
    console.log('EditContactDialog: contact:', contact);
    console.log('EditContactDialog: open:', open);
    console.log('EditContactDialog: neighborhoods:', neighborhoods);

    if (!contact || !open) {
      console.log('EditContactDialog: Sem contato ou dialog fechado, saindo do useEffect');
      return;
    }

    try {
      console.log('EditContactDialog: Carregando dados do contato:', contact);
      
      // Verificar se todos os campos obrigatórios existem
      const requiredFields = ['id', 'name'];
      const missingFields = requiredFields.filter(field => !contact[field]);
      if (missingFields.length > 0) {
        console.error('EditContactDialog: Campos obrigatórios faltando:', missingFields);
        toast({
          title: "Erro",
          description: `Dados do contato incompletos: ${missingFields.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      let city_id = contact?.city_id || '';
      if (!city_id && contact?.neighborhood && neighborhoods && neighborhoods.length > 0) {
        const nb = neighborhoods.find(nb => nb.name === contact.neighborhood);
        city_id = nb?.city_id || '';
        console.log('EditContactDialog: City ID encontrado via bairro:', city_id);
      }
      
      const formData = {
        name: contact?.name || '',
        whatsapp: contact?.whatsapp || '',
        email: contact?.email || '',
        neighborhood: contact?.neighborhood || '',
        city_id: city_id,
        birth_date: contact?.birth_date || '',
        encounter_with_god: Boolean(contact?.encounter_with_god),
        baptized: Boolean(contact?.baptized),
        status: contact?.status || 'pending',
        cell_id: contact?.cell_id || '',
        referred_by: contact?.referred_by || '',
        photo_url: contact?.photo_url || null,
        founder: Boolean(contact?.founder),
        leader_id: contact?.leader_id || '',
      };

      console.log('EditContactDialog: Dados do formulário preparados:', formData);
      setForm(formData);
    } catch (error) {
      console.error('EditContactDialog: Erro ao processar dados do contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do contato",
        variant: "destructive",
      });
    }
  }, [contact, neighborhoods, open]);

  // Verificação de segurança - não renderizar se não tiver contato
  if (!contact) {
    console.log('EditContactDialog: Contato não encontrado, não renderizando');
    return null;
  }

  // Verificação de campos obrigatórios do contato
  if (!contact.id || !contact.name) {
    console.error('EditContactDialog: Contato com dados obrigatórios faltando:', contact);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8 text-red-600">
            <span>Erro: Dados do contato incompletos</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Aguardar dados serem carregados
  if (!neighborhoods || !cities) {
    console.log('EditContactDialog: Aguardando dados serem carregados');
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Carregando...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const filteredNeighborhoods = form.city_id && neighborhoods
    ? neighborhoods.filter(nb => nb.city_id === form.city_id)
    : neighborhoods || [];

  const handleSave = async () => {
    console.log('EditContactDialog: Iniciando salvamento');
    
    if (!form.name || !form.whatsapp || !form.neighborhood) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios (Nome, WhatsApp e Bairro).",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      let newStatus = contact.status;
      if (form.cell_id && form.cell_id !== contact.cell_id) {
        newStatus = 'member';
      } else if (!form.cell_id && contact.cell_id) {
        newStatus = 'pending';
      }

      let referredByValue = null;
      if (form.referred_by && form.referred_by !== 'no-referral' && form.referred_by !== '') {
        referredByValue = form.referred_by;
      }

      let leaderIdValue = null;
      if (form.leader_id && form.leader_id !== '') {
        leaderIdValue = form.leader_id;
      }

      const updateData = {
        name: form.name,
        whatsapp: form.whatsapp,
        neighborhood: form.neighborhood,
        city_id: form.city_id || null,
        birth_date: form.birth_date || null,
        encounter_with_god: !!form.encounter_with_god,
        baptized: !!form.baptized,
        status: newStatus,
        cell_id: form.cell_id || null,
        referred_by: referredByValue,
        photo_url: form.photo_url,
        founder: !!form.founder,
        leader_id: leaderIdValue,
      };

      console.log('EditContactDialog: Dados para atualização:', updateData);
      await updateContact(contact.id, updateData);
      
      if (onContactUpdated) {
        onContactUpdated();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('EditContactDialog: Erro ao atualizar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar contato",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTransformToMember = async () => {
    setSaving(true);
    try {
      await updateContact(contact.id, {
        status: 'member'
      });
      
      if (onContactUpdated) {
        onContactUpdated();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('EditContactDialog: Erro ao transformar em membro:', error);
      toast({
        title: "Erro",
        description: "Erro ao transformar visitante em membro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTransferCell = async () => {
    setSaving(true);
    try {
      await updateContact(contact.id, {
        cell_id: form.cell_id || null,
        status: form.cell_id ? 'member' : 'pending'
      });
      
      if (onContactUpdated) {
        onContactUpdated();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('EditContactDialog: Erro ao transferir célula:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir membro para célula",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getCellName = (cellId: string) => {
    const cell = cells?.find(c => c.id === cellId);
    return cell ? cell.name : 'Célula não encontrada';
  };

  const isVisitor = contact?.status === 'visitor';
  const isMember = contact?.status === 'member';
  const isPending = contact?.status === 'pending';
  
  const showTransformButton = context === 'cell' && isVisitor;
  const showTransferButton = isMember && contact?.cell_id !== form.cell_id && form.cell_id;
  const showCellField = isMember || context === 'contacts' || isPending;

  const getStatusBadge = () => {
    if (isMember) return { variant: 'default', text: 'Membro' };
    if (isVisitor) return { variant: 'secondary', text: 'Visitante' };
    return { variant: 'outline', text: 'Pendente' };
  };

  const statusBadge = getStatusBadge();

  const updateFormData = (updates: any) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  // Preparar valores seguros para os Select components
  const safeValues = {
    city: form.city_id || 'empty-city',
    neighborhood: form.neighborhood || 'empty-neighborhood'
  };

  console.log('EditContactDialog: Renderizando dialog completo');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Editar {statusBadge.text}
            <Badge variant={statusBadge.variant as any}>
              {statusBadge.text}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Foto do Contato</Label>
            <PhotoUpload
              currentPhotoUrl={form.photo_url}
              onPhotoChange={(photoUrl) => setForm(f => ({ ...f, photo_url: photoUrl }))}
              contactName={form.name || 'Contato'}
            />
          </div>

          <div>
            <Label htmlFor="edit-contact-name">Nome *</Label>
            <Input
              id="edit-contact-name"
              placeholder="Nome"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-contact-whatsapp">Whatsapp *</Label>
            <Input
              id="edit-contact-whatsapp"
              placeholder="Whatsapp"
              value={form.whatsapp}
              onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-contact-city">Cidade</Label>
            <Select
              value={safeValues.city}
              onValueChange={value => {
                const newCityId = value === "empty-city" ? "" : value;
                setForm(f => ({
                  ...f,
                  city_id: newCityId,
                  neighborhood: "",
                }));
              }}
            >
              <SelectTrigger id="edit-contact-city">
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty-city">Selecione uma cidade</SelectItem>
                {(cities || []).map(city => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name} - {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="edit-contact-neighborhood">Bairro *</Label>
            <Select
              value={safeValues.neighborhood}
              onValueChange={value =>
                setForm(f => ({
                  ...f,
                  neighborhood: value === "empty-neighborhood" ? "" : value,
                }))
              }
            >
              <SelectTrigger id="edit-contact-neighborhood">
                <SelectValue placeholder="Selecione o bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="empty-neighborhood">Selecione um bairro</SelectItem>
                {filteredNeighborhoods.map(nb => (
                  <SelectItem key={nb.id} value={nb.name}>
                    {nb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-contact-birth-date">Data de Nascimento</Label>
            <Input
              id="edit-contact-birth-date"
              type="date"
              value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <EncounterWithGodField
              checked={!!form.encounter_with_god}
              onChange={checked =>
                setForm(f => ({ ...f, encounter_with_god: checked }))
              }
            />
            <BaptizedField
              checked={!!form.baptized}
              onChange={checked =>
                setForm(f => ({ ...f, baptized: checked }))
              }
            />
            <FounderField
              checked={!!form.founder}
              onChange={checked =>
                setForm(f => ({ ...f, founder: checked }))
              }
            />
          </div>

          <LeaderField
            value={form.leader_id}
            onChange={value => setForm(f => ({ ...f, leader_id: value }))}
            profiles={profiles || []}
          />

          {showCellField && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Células</h4>
              <ReferralAndCellFields
                formData={form}
                onUpdateFormData={updateFormData}
                cells={cells || []}
                contacts={contacts || []}
                profiles={profiles || []}
              />
              {contact.cell_id && (
                <p className="text-xs text-gray-500 mt-2">
                  Célula atual: {getCellName(contact.cell_id)}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2">
          {showTransformButton && (
            <Button 
              onClick={handleTransformToMember} 
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {saving ? "Transformando..." : "Transformar em Membro"}
            </Button>
          )}

          {showTransferButton && (
            <Button 
              onClick={handleTransferCell} 
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              {saving ? "Transferindo..." : "Transferir para Nova Célula"}
            </Button>
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
